import { defaultEdits, normalizeEdits, type EditSettings } from './edits'
import { renderExport } from './exportPhoto'
import { THUMB_SIZE } from './imageMeta'

/** Long edge of the picture shown in the viewer. */
export const PREVIEW_EDGE = 1600

type Source = { width?: number; height?: number }

/** Renders the photo with its edits at viewer size. Decodes the original at a reduced size to keep memory low. */
export async function makePreview(original: Blob, photo: Source, edits: EditSettings | undefined): Promise<Blob> {
  const out = await renderExport(
    original,
    photo,
    normalizeEdits(edits),
    { format: 'jpeg', quality: 85, size: PREVIEW_EDGE },
    { sourceMaxEdge: 2048 },
  )
  return out.blob
}

/** Renders a grid thumbnail of the unedited photo, for reverting edits. */
export async function makeOriginalThumb(original: Blob, photo: Source): Promise<Blob> {
  const out = await renderExport(
    original,
    photo,
    defaultEdits,
    { format: 'jpeg', quality: 80, size: THUMB_SIZE },
    { sourceMaxEdge: 1024 },
  )
  return out.blob
}

/** Identifies a preview: it is only valid for the edits it was made with. */
export const previewKey = (photo: { id: string; edits?: EditSettings }) => `${photo.id}:${JSON.stringify(photo.edits ?? null)}`

/** Keeps object URLs for the most recently viewed previews and releases older ones. */
export class PreviewUrlCache {
  private urls = new Map<string, string>()
  private max: number
  private create: (blob: Blob) => string
  private revoke: (url: string) => void
  private revokeDelayMs: number

  constructor(
    max = 12,
    create: (blob: Blob) => string = (b) => URL.createObjectURL(b),
    revoke: (url: string) => void = (u) => URL.revokeObjectURL(u),
    revokeDelayMs = 5000,
  ) {
    this.max = max
    this.create = create
    this.revoke = revoke
    this.revokeDelayMs = revokeDelayMs
  }

  /** Returns the URL and marks it as recently used. */
  get(key: string): string | undefined {
    const url = this.urls.get(key)
    if (url !== undefined) {
      this.urls.delete(key)
      this.urls.set(key, url)
    }
    return url
  }

  /** Makes a URL for the blob, or returns the existing one. */
  add(key: string, blob: Blob): string {
    const existing = this.get(key)
    if (existing) return existing
    const url = this.create(blob)
    this.urls.set(key, url)
    while (this.urls.size > this.max) {
      const [oldKey, oldUrl] = this.urls.entries().next().value as [string, string]
      this.urls.delete(oldKey)
      // An <img> may still be showing it, so release it a little later.
      setTimeout(() => this.revoke(oldUrl), this.revokeDelayMs)
    }
    return url
  }
}
