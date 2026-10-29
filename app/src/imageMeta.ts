export const THUMB_SIZE = 320

export function fitWithin(width: number, height: number, max: number) {
  const scale = Math.min(1, max / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export type ExifSummary = {
  takenAt?: number
  make?: string
  model?: string
}

export function summarizeExif(raw: Record<string, unknown> | undefined): ExifSummary {
  if (!raw) return {}
  const date = raw.DateTimeOriginal ?? raw.CreateDate
  const takenAt = date instanceof Date && !isNaN(date.getTime()) ? date.getTime() : undefined
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
  return { takenAt, make: str(raw.Make), model: str(raw.Model) }
}
