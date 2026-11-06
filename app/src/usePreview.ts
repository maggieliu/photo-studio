import { useEffect, useState } from 'react'
import { makePreview, PreviewUrlCache, previewKey } from './preview'
import type { LibraryPhoto } from './useLibrary'

// Shared across viewer opens, so going back to a photo you just looked at is instant.
const cache = new PreviewUrlCache()

type Options = {
  getOriginal: (id: string) => Promise<Blob | undefined>
  savePreview: (id: string, editsJson: string, preview: Blob) => Promise<void>
}

/**
 * The picture for the viewer: a saved preview if there is one, otherwise it is
 * rendered from the original (with edits) and saved for next time.
 */
export function usePreview(photo: LibraryPhoto, { getOriginal, savePreview }: Options) {
  const key = previewKey(photo)
  const known = cache.get(key) ?? (photo.preview ? cache.add(key, photo.preview) : undefined)
  const [made, setMade] = useState<{ key: string; url: string }>()
  const [failedKey, setFailedKey] = useState<string>()

  const { id, edits, width, height } = photo
  useEffect(() => {
    if (known) return
    let cancelled = false
    ;(async () => {
      try {
        const original = await getOriginal(id)
        if (!original) throw new Error('The original file is missing')
        const blob = await makePreview(original, { width, height }, edits)
        if (cancelled) return
        setMade({ key, url: cache.add(key, blob) })
        // Saving is a bonus; the picture is already on screen.
        savePreview(id, JSON.stringify(edits ?? null), blob).catch(() => {})
      } catch {
        if (!cancelled) setFailedKey(key)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [key, known, id, edits, width, height, getOriginal, savePreview])

  const url = known ?? (made?.key === key ? made.url : undefined)
  return { url, failed: !url && failedKey === key }
}
