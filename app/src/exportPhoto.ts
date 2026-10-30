import { decodeForEditing } from './decode'
import { normalizeEdits, isDefaultEdits, type EditSettings } from './edits'
import { exportFileName, formatInfo, planExportSize, type ExportOptions } from './exportOptions'
import { outputSize } from './geometry'
import { BufferLimitError, Renderer } from './renderer'

/** Decoded sources are capped here even if the GPU could take more. */
const SOURCE_MAX_EDGE = 8192

export type RenderedExport = {
  blob: Blob
  width: number
  height: number
  /** True when the result is smaller than asked for because of device limits. */
  reduced: boolean
}

/** Renders one photo at export quality with the same shader the editor previews with. */
export async function renderExport(
  original: Blob,
  photo: { width?: number; height?: number },
  edits: EditSettings,
  options: ExportOptions,
): Promise<RenderedExport> {
  const info = formatInfo(options.format)
  const renderer = new Renderer(document.createElement('canvas'))
  try {
    const bitmap = await decodeForEditing(original, photo, Math.min(renderer.maxTextureSize, SOURCE_MAX_EDGE))
    renderer.setSource(bitmap)

    // What the user asked for, measured on the true original when we know its size.
    const trueSize = photo.width && photo.height ? outputSize(edits, photo.width, photo.height) : outputSize(edits, bitmap.width, bitmap.height)
    const trueLongest = Math.max(trueSize.width, trueSize.height)
    const wantedEdge = options.size === 'original' ? trueLongest : Math.min(options.size, trueLongest)

    const decoded = outputSize(edits, bitmap.width, bitmap.height)
    let { maxEdge } = planExportSize(decoded.width, decoded.height, options.size, renderer.maxTextureSize)

    // Some phones silently give a smaller canvas than asked for; back off until it fits.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const blob = await renderer.toBlob(edits, maxEdge, info.mime, options.quality / 100)
        if (blob.type !== info.mime) throw new Error(`This browser cannot save ${info.label} files`)
        const size = outputSize(edits, bitmap.width, bitmap.height, maxEdge)
        return {
          blob,
          width: size.width,
          height: size.height,
          reduced: Math.max(size.width, size.height) < wantedEdge - 1,
        }
      } catch (e) {
        if (!(e instanceof BufferLimitError)) throw e
        maxEdge = Math.floor(maxEdge * 0.75)
      }
    }
    throw new BufferLimitError()
  } finally {
    renderer.dispose(true)
  }
}

export type ExportItem = { photo: { id: string; name: string; width?: number; height?: number }; edits?: EditSettings }

export type ExportedFile = {
  id: string
  file: File
  width: number
  height: number
  reduced: boolean
}

export type ExportRun = {
  files: ExportedFile[]
  errors: string[]
  cancelled: boolean
}

/** Exports photos one at a time so only one full-size image is in memory at once. */
export async function runExport(
  items: ExportItem[],
  options: ExportOptions,
  getOriginal: (id: string) => Promise<Blob | undefined>,
  hooks: { onProgress?: (done: number, total: number) => void; isCancelled?: () => boolean } = {},
): Promise<ExportRun> {
  const info = formatInfo(options.format)
  const taken = new Set<string>()
  const run: ExportRun = { files: [], errors: [], cancelled: false }

  for (const [i, item] of items.entries()) {
    if (hooks.isCancelled?.()) {
      run.cancelled = true
      break
    }
    hooks.onProgress?.(i, items.length)
    try {
      const original = await getOriginal(item.photo.id)
      if (!original) throw new Error('the original file is missing')
      const edits = normalizeEdits(item.edits)
      const out = await renderExport(original, item.photo, edits, options)
      const name = exportFileName(item.photo.name, !isDefaultEdits(edits), info.ext, taken)
      run.files.push({
        id: item.photo.id,
        file: new File([out.blob], name, { type: info.mime }),
        width: out.width,
        height: out.height,
        reduced: out.reduced,
      })
    } catch (e) {
      run.errors.push(`${item.photo.name}: ${e instanceof Error ? e.message : 'export failed'}`)
    }
  }
  hooks.onProgress?.(items.length, items.length)
  return run
}
