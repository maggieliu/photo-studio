import { fitWithin } from './imageMeta'

/**
 * Decodes an image for editing, scaled so its long edge is at most `maxEdge`.
 * Orientation from EXIF is applied, matching what the catalog shows.
 */
export async function decodeForEditing(blob: Blob, knownSize: { width?: number; height?: number }, maxEdge: number) {
  const { width, height } = knownSize
  if (width && height && Math.max(width, height) > maxEdge) {
    const target = fitWithin(width, height, maxEdge)
    try {
      return await createImageBitmap(blob, {
        resizeWidth: target.width,
        resizeHeight: target.height,
        resizeQuality: 'high',
        imageOrientation: 'from-image',
      })
    } catch {
      // Some browsers reject the resize options; fall back to a full decode below.
    }
  }
  const full = await createImageBitmap(blob)
  if (Math.max(full.width, full.height) <= maxEdge) return full

  const target = fitWithin(full.width, full.height, maxEdge)
  const small = await createImageBitmap(full, { resizeWidth: target.width, resizeHeight: target.height, resizeQuality: 'high' })
  full.close()
  return small
}
