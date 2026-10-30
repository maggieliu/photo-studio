export type ExportFormat = 'jpeg' | 'png' | 'webp'
export type SizeChoice = 'original' | number

export type ExportOptions = {
  format: ExportFormat
  /** 1 – 100, used by JPEG and WebP. */
  quality: number
  /** Long edge in pixels, or the original size. Never scales up. */
  size: SizeChoice
}

export const defaultExportOptions: ExportOptions = { format: 'jpeg', quality: 90, size: 'original' }

export const FORMATS: { id: ExportFormat; label: string; mime: string; ext: string; lossy: boolean }[] = [
  { id: 'jpeg', label: 'JPEG', mime: 'image/jpeg', ext: 'jpg', lossy: true },
  { id: 'png', label: 'PNG', mime: 'image/png', ext: 'png', lossy: false },
  { id: 'webp', label: 'WebP', mime: 'image/webp', ext: 'webp', lossy: true },
]

export const SIZE_PRESETS: { label: string; size: SizeChoice }[] = [
  { label: 'Original', size: 'original' },
  { label: '4096 px', size: 4096 },
  { label: '2048 px', size: 2048 },
  { label: '1080 px', size: 1080 },
]

/** Largest export, in pixels. Bigger images risk running a phone out of memory. */
export const MAX_EXPORT_PIXELS = 33_177_600

export const formatInfo = (id: ExportFormat) => FORMATS.find((f) => f.id === id) ?? FORMATS[0]

/** Formats this browser can really encode (canvas silently falls back to PNG otherwise). */
export function supportedFormats(): ExportFormat[] {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    return FORMATS.filter((f) => f.id === 'png' || canvas.toDataURL(f.mime).startsWith(`data:${f.mime}`)).map((f) => f.id)
  } catch {
    return ['png']
  }
}

/** Reads options saved earlier; anything invalid falls back to the defaults. */
export function normalizeExportOptions(raw: unknown): ExportOptions {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof ExportOptions, unknown>>
  const format = FORMATS.some((f) => f.id === r.format) ? (r.format as ExportFormat) : defaultExportOptions.format
  const quality =
    typeof r.quality === 'number' && Number.isFinite(r.quality)
      ? Math.min(100, Math.max(1, Math.round(r.quality)))
      : defaultExportOptions.quality
  const size =
    r.size === 'original'
      ? 'original'
      : typeof r.size === 'number' && Number.isFinite(r.size) && r.size >= 16
        ? Math.min(16384, Math.round(r.size))
        : defaultExportOptions.size
  return { format, quality, size }
}

const stripExtension = (name: string) => name.replace(/\.[^./\\]+$/, '') || name

/** "IMG_1.CR2" → "IMG_1-edited.jpg", with -2, -3… added if the name is already taken. */
export function exportFileName(photoName: string, edited: boolean, ext: string, taken: Set<string>): string {
  const base = `${stripExtension(photoName)}${edited ? '-edited' : ''}`
  let name = `${base}.${ext}`
  for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base}-${n}.${ext}`
  taken.add(name.toLowerCase())
  return name
}

/**
 * Picks the long edge to render at: the requested size, but never more than
 * the source has, and never beyond what the GPU and memory allow.
 */
export function planExportSize(outWidth: number, outHeight: number, size: SizeChoice, maxTexture: number) {
  const longest = Math.max(outWidth, outHeight)
  const requested = size === 'original' ? longest : Math.min(size, longest)
  const scale = requested / longest
  const areaScale = Math.min(1, Math.sqrt(MAX_EXPORT_PIXELS / (outWidth * scale * outHeight * scale)))
  const edge = Math.max(1, Math.floor(Math.min(requested * areaScale, maxTexture)))
  return { maxEdge: edge, reduced: edge < requested }
}
