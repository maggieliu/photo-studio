import { fitWithin } from './imageMeta'

/** Formats that can carry transparency. JPEG and HEIC photos never do in practice. */
export function canHaveAlpha(mimeType: string): boolean {
  return /^image\/(png|webp|gif|avif|svg\+xml)$/i.test(mimeType)
}

/** True when any pixel is not fully opaque. Checks a small copy, which is enough for logos and cut-outs. */
export function hasTransparency(bitmap: ImageBitmap): boolean {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false
  ctx.drawImage(bitmap, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)
  canvas.width = canvas.height = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true
  return false
}

/**
 * Paints the image over white. Transparent pixels would otherwise turn black in
 * the editor and in JPEG files. Closes the bitmap it is given.
 */
export async function flattenOnWhite(bitmap: ImageBitmap): Promise<ImageBitmap> {
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return bitmap
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0)
  const flat = await createImageBitmap(canvas)
  canvas.width = canvas.height = 0
  bitmap.close()
  return flat
}

async function decode(blob: Blob, knownSize: { width?: number; height?: number }, maxEdge: number) {
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

/**
 * Decodes an image for editing, scaled so its long edge is at most `maxEdge`.
 * Orientation from EXIF is applied, matching what the catalog shows. Transparent
 * areas are filled with white.
 */
export async function decodeForEditing(blob: Blob, knownSize: { width?: number; height?: number }, maxEdge: number) {
  const bitmap = await decode(blob, knownSize, maxEdge)
  return canHaveAlpha(blob.type) && hasTransparency(bitmap) ? flattenOnWhite(bitmap) : bitmap
}
