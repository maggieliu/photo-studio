import type { EditSettings } from './edits'
import { outputSize, outputToSource } from './geometry'

const VERTEX = `#version 300 es
in vec2 a_pos;
out vec2 v_p;
void main() {
  // v_p runs 0–1 with y pointing down, like image coordinates.
  v_p = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_p;
out vec4 outColor;

uniform sampler2D u_tex;
uniform mat3 u_m;
uniform vec2 u_texel;
uniform float u_exposure, u_contrast, u_highlights, u_shadows, u_whites, u_blacks;
uniform float u_temperature, u_tint, u_vibrance, u_saturation, u_sharpness;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

void main() {
  vec2 uv = (u_m * vec3(v_p, 1.0)).xy;
  vec3 c = texture(u_tex, uv).rgb;

  if (u_sharpness > 0.0) {
    vec3 blur = 0.25 * (
      texture(u_tex, uv + vec2(u_texel.x, 0.0)).rgb +
      texture(u_tex, uv - vec2(u_texel.x, 0.0)).rgb +
      texture(u_tex, uv + vec2(0.0, u_texel.y)).rgb +
      texture(u_tex, uv - vec2(0.0, u_texel.y)).rgb);
    c += (c - blur) * u_sharpness * 2.5;
  }

  // White balance.
  c.r *= 1.0 + u_temperature * 0.25;
  c.b *= 1.0 - u_temperature * 0.25;
  c.g *= 1.0 - u_tint * 0.15;

  // Exposure in linear light, +/-2 stops.
  c = pow(max(c, vec3(0.0)), vec3(2.2));
  c *= exp2(u_exposure * 2.0);
  c = pow(c, vec3(1.0 / 2.2));

  // Highlights and shadows.
  float l = dot(c, LUMA);
  float shadowMask = 1.0 - smoothstep(0.0, 0.6, l);
  float highlightMask = smoothstep(0.4, 1.0, l);
  c *= 1.0 + u_shadows * 0.8 * shadowMask + u_highlights * 0.5 * highlightMask;

  // Black and white points.
  float blackPoint = -u_blacks * 0.12;
  float whitePoint = 1.0 - u_whites * 0.12;
  c = (c - blackPoint) / (whitePoint - blackPoint);

  c = (c - 0.5) * (1.0 + u_contrast * 0.8) + 0.5;

  // Saturation, plus vibrance which favours muted colours.
  float gray = dot(c, LUMA);
  float chroma = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  float boost = 1.0 + u_saturation + u_vibrance * (1.0 - clamp(chroma, 0.0, 1.0));
  c = mix(vec3(gray), c, boost);

  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`

const UNIFORMS = [
  'u_tex',
  'u_m',
  'u_texel',
  'u_exposure',
  'u_contrast',
  'u_highlights',
  'u_shadows',
  'u_whites',
  'u_blacks',
  'u_temperature',
  'u_tint',
  'u_vibrance',
  'u_saturation',
  'u_sharpness',
] as const

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Shader error: ${gl.getShaderInfoLog(shader)}`)
  }
  return shader
}

/** The browser gave the canvas a smaller drawing buffer than requested. */
export class BufferLimitError extends Error {
  constructor() {
    super('This device cannot render an image that large')
    this.name = 'BufferLimitError'
  }
}

/** Sharpening is tuned on a preview of this size; bigger sources scale the radius to match. */
const SHARPEN_REFERENCE_EDGE = 2048

/** Draws one photo through the edit pipeline onto a canvas. */
export class Renderer {
  readonly canvas: HTMLCanvasElement
  onContextLost?: () => void
  onContextRestored?: () => void

  private gl: WebGL2RenderingContext
  private texture: WebGLTexture | null = null
  private uniforms: Partial<Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>> = {}
  private bitmap: ImageBitmap | null = null
  private lost = false

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    // preserveDrawingBuffer lets canvas.toBlob read the frame after drawing.
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: true })
    if (!gl) throw new Error('WebGL2 is not available in this browser')
    this.gl = gl
    this.init()
    canvas.addEventListener('webglcontextlost', this.handleLost)
    canvas.addEventListener('webglcontextrestored', this.handleRestored)
  }

  /** Largest texture or render target edge this GPU supports. */
  get maxTextureSize(): number {
    const gl = this.gl
    return Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE))
  }

  get sourceSize() {
    return this.bitmap ? { width: this.bitmap.width, height: this.bitmap.height } : undefined
  }

  private handleLost = (e: Event) => {
    e.preventDefault()
    this.lost = true
    this.onContextLost?.()
  }

  private handleRestored = () => {
    this.lost = false
    this.init()
    if (this.bitmap) this.upload(this.bitmap)
    this.onContextRestored?.()
  }

  private init() {
    const gl = this.gl
    const program = gl.createProgram()!
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX))
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`)
    }
    gl.useProgram(program)
    for (const name of UNIFORMS) this.uniforms[name] = gl.getUniformLocation(program, name)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    this.texture = null
  }

  private upload(bitmap: ImageBitmap) {
    const gl = this.gl
    if (this.texture) gl.deleteTexture(this.texture)
    this.texture = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  /** Takes ownership of the bitmap; it is closed when replaced or disposed. */
  setSource(bitmap: ImageBitmap) {
    this.bitmap?.close()
    this.bitmap = bitmap
    this.upload(bitmap)
  }

  /** Renders the edits and returns the pixel size of the result. */
  render(edits: EditSettings, maxEdge = Infinity) {
    const bitmap = this.bitmap
    if (!bitmap || this.lost) return undefined
    const gl = this.gl
    const { width, height } = outputSize(edits, bitmap.width, bitmap.height, maxEdge)
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
    }
    gl.viewport(0, 0, width, height)

    const [a, b, c, d, e, f] = outputToSource(edits, bitmap.width, bitmap.height)
    const u = this.uniforms
    // mat3 is column-major.
    gl.uniformMatrix3fv(u.u_m ?? null, false, [a, b, 0, c, d, 0, e, f, 1])
    gl.uniform1i(u.u_tex ?? null, 0)
    const sharpenScale = Math.max(1, Math.max(bitmap.width, bitmap.height) / SHARPEN_REFERENCE_EDGE)
    gl.uniform2f(u.u_texel ?? null, sharpenScale / bitmap.width, sharpenScale / bitmap.height)
    gl.uniform1f(u.u_exposure ?? null, edits.exposure / 100)
    gl.uniform1f(u.u_contrast ?? null, edits.contrast / 100)
    gl.uniform1f(u.u_highlights ?? null, edits.highlights / 100)
    gl.uniform1f(u.u_shadows ?? null, edits.shadows / 100)
    gl.uniform1f(u.u_whites ?? null, edits.whites / 100)
    gl.uniform1f(u.u_blacks ?? null, edits.blacks / 100)
    gl.uniform1f(u.u_temperature ?? null, edits.temperature / 100)
    gl.uniform1f(u.u_tint ?? null, edits.tint / 100)
    gl.uniform1f(u.u_vibrance ?? null, edits.vibrance / 100)
    gl.uniform1f(u.u_saturation ?? null, edits.saturation / 100)
    gl.uniform1f(u.u_sharpness ?? null, edits.sharpness / 100)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    return { width, height }
  }

  /**
   * Renders at a different size and encodes it. The frame is captured before
   * this returns, so the caller may render the preview again straight away.
   */
  toBlob(edits: EditSettings, maxEdge: number, type = 'image/jpeg', quality = 0.85): Promise<Blob> {
    const size = this.render(edits, maxEdge)
    if (!size) return Promise.reject(new Error('Nothing to render'))
    if (this.gl.drawingBufferWidth < size.width || this.gl.drawingBufferHeight < size.height) {
      return Promise.reject(new BufferLimitError())
    }
    return new Promise((resolve, reject) =>
      this.canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Encoding failed'))), type, quality),
    )
  }

  dispose(releaseGpu = false) {
    this.canvas.removeEventListener('webglcontextlost', this.handleLost)
    this.canvas.removeEventListener('webglcontextrestored', this.handleRestored)
    if (this.texture) this.gl.deleteTexture(this.texture)
    this.texture = null
    this.bitmap?.close()
    this.bitmap = null
    // Phones allow only a few live GL contexts and hold their memory until
    // collected. Only for canvases that are thrown away: a lost context cannot
    // be reused by a new Renderer on the same canvas.
    if (releaseGpu) this.gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
