import { useEffect, useState } from 'react'
import { describePreviewError, makePreview, PreviewUrlCache, previewKey } from './preview'
import type { LibraryPhoto } from './useLibrary'

// Shared across viewer opens, so going back to a photo you just looked at is instant.
const cache = new PreviewUrlCache()

type Options = {
  getOriginal: (id: string) => Promise<Blob | undefined>
  savePreview: (id: string, editsJson: string, preview: Blob) => Promise<void>
}

/**
 * The picture for the viewer: a saved preview if there is one, otherwise it is
 * rendered from the original (with edits) and saved for next time. If that fails
 * and the photo has no edits, the original file itself is shown instead.
 */
export function usePreview(photo: LibraryPhoto, { getOriginal, savePreview }: Options) {
  const key = previewKey(photo)
  const known = cache.get(key) ?? (photo.preview ? cache.add(key, photo.preview) : undefined)
  const [made, setMade] = useState<{ key: string; url: string }>()
  const [failure, setFailure] = useState<{ key: string; reason: string }>()

  const { id, edits, width, height } = photo
  useEffect(() => {
    if (known) return
    let cancelled = false
    ;(async () => {
      let original: Blob | undefined
      try {
        original = await getOriginal(id)
        if (!original) throw new Error('The original file is missing')
        const blob = await makePreview(original, { width, height }, edits)
        if (cancelled) return
        setMade({ key, url: cache.add(key, blob) })
        // Saving is a bonus; the picture is already on screen.
        savePreview(id, JSON.stringify(edits ?? null), blob).catch(() => {})
      } catch (e) {
        if (cancelled) return
        console.error('Could not make the preview', e)
        // Without edits, the original file is exactly what should be shown, so use it as it is.
        if (original && !edits) {
          setMade({ key, url: cache.add(key, original) })
          return
        }
        setFailure({ key, reason: describePreviewError(e) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [key, known, id, edits, width, height, getOriginal, savePreview])

  const url = known ?? (made?.key === key ? made.url : undefined)
  const failed = !url && failure?.key === key
  return { url, failed, reason: failed ? failure.reason : undefined }
}
