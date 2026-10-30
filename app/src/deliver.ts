import { Zip, ZipPassThrough } from 'fflate'

/** Bundles files into one zip. Photos are already compressed, so they are stored as-is. */
export async function zipFiles(files: File[]): Promise<Blob> {
  const chunks: BlobPart[] = []
  let failure: Error | undefined
  const zip = new Zip((err, chunk) => {
    if (err) failure = err
    else chunks.push(chunk as BlobPart)
  })
  for (const file of files) {
    const entry = new ZipPassThrough(file.name)
    zip.add(entry)
    entry.push(new Uint8Array(await file.arrayBuffer()), true)
  }
  zip.end()
  if (failure) throw failure
  return new Blob(chunks, { type: 'application/zip' })
}

export function canShareFiles(files: File[]): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files })
  } catch {
    return false
  }
}

/** Opens the system share sheet (Save to Photos, Files, AirDrop…). Resolves false if the user dismissed it. */
export async function shareFiles(files: File[]): Promise<boolean> {
  try {
    await navigator.share({ files })
    return true
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return false
    throw e
  }
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  // Give the browser time to start reading the blob before releasing it.
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
