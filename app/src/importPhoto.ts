import exifr from 'exifr'
import type { Catalog, PhotoRecord } from './catalog'
import { fitWithin, summarizeExif, THUMB_SIZE } from './imageMeta'

async function makeThumbnail(bitmap: ImageBitmap): Promise<Blob> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, THUMB_SIZE)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')
  ctx.drawImage(bitmap, 0, 0, width, height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Thumbnail encode failed'))), 'image/jpeg', 0.8),
  )
}

export async function importPhoto(file: File, catalog: Catalog): Promise<PhotoRecord> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error(`${file.name}: this browser can't decode this image type`)
  }

  try {
    const exif = summarizeExif(
      await exifr
        .parse(file, ['DateTimeOriginal', 'CreateDate', 'Make', 'Model'])
        .catch(() => undefined),
    )
    const photo: PhotoRecord = {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type,
      addedAt: Date.now(),
      ...exif,
      width: bitmap.width,
      height: bitmap.height,
      thumb: await makeThumbnail(bitmap),
    }
    await catalog.add(photo, file)
    return photo
  } finally {
    bitmap.close()
  }
}

export type ImportSummary = { imported: number; errors: string[] }

export async function importPhotos(
  files: File[],
  catalog: Catalog,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportSummary> {
  const errors: string[] = []
  let imported = 0
  for (const [i, file] of files.entries()) {
    try {
      await importPhoto(file, catalog)
      imported++
    } catch (e) {
      errors.push(e instanceof Error ? e.message : `${file.name}: import failed`)
    }
    onProgress?.(i + 1, files.length)
  }
  return { imported, errors }
}
