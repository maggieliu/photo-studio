import exifr from 'exifr'
import type { Catalog, PhotoRecord } from './catalog'
import { fitWithin, summarizeExif, THUMB_SIZE } from './imageMeta'

/** Turns a browser storage failure into something a person can act on. */
export function describeStorageError(error: unknown, fileName: string): string {
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : ''
  if (name === 'QuotaExceededError' || /quota/i.test(message)) {
    return `${fileName}: there is no space left on this device for this photo.`
  }
  // WebKit reports "Error preparing Blob/File data to be stored in object store" when it will not keep photo files,
  // which is what Safari does in a Private tab.
  if (/blob\/file data|object store/i.test(message) || name === 'DataCloneError' || name === 'UnknownError') {
    return `${fileName}: your browser could not save this photo. If you are in a Private tab, open the site in a normal tab and try again.`
  }
  return `${fileName}: could not save this photo.`
}

async function makeThumbnail(bitmap: ImageBitmap): Promise<Blob> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, THUMB_SIZE)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')
  // Thumbnails are JPEG, which has no transparency: without this, transparent areas turn black.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Thumbnail encode failed'))), 'image/jpeg', 0.8),
  )
}

export async function importPhoto(file: File, catalog: Catalog, albumId?: string): Promise<PhotoRecord> {
  // Copy the file into memory first. Files from a phone's photo picker can be backed by a temporary file that
  // disappears, which makes saving them fail later. A copy in memory is safe to decode and to store.
  let data: Blob
  try {
    data = new Blob([await file.arrayBuffer()], { type: file.type })
  } catch {
    throw new Error(`${file.name}: could not read this file. If it is stored in iCloud, wait for it to download and try again.`)
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(data)
  } catch {
    throw new Error(`${file.name}: this browser can't decode this image type`)
  }

  try {
    const exif = summarizeExif(
      await exifr
        .parse(data, ['DateTimeOriginal', 'CreateDate', 'Make', 'Model'])
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
      rating: 0,
      favorite: false,
      tags: [],
      albumIds: albumId ? [albumId] : [],
    }
    try {
      await catalog.add(photo, data)
    } catch (e) {
      throw new Error(describeStorageError(e, file.name))
    }
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
  albumId?: string,
): Promise<ImportSummary> {
  const errors: string[] = []
  let imported = 0
  for (const [i, file] of files.entries()) {
    try {
      await importPhoto(file, catalog, albumId)
      imported++
    } catch (e) {
      errors.push(e instanceof Error ? e.message : `${file.name}: import failed`)
    }
    onProgress?.(i + 1, files.length)
  }
  return { imported, errors }
}
