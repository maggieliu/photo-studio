import { useCallback, useEffect, useRef, useState } from 'react'
import { openCatalog, type AlbumRecord, type Catalog, type PhotoRecord } from './catalog'
import { isDefaultEdits, type EditSettings } from './edits'
import { importPhotos } from './importPhoto'
import { ThumbUrlCache } from './thumbUrls'

export type LibraryPhoto = PhotoRecord & { thumbUrl: string }

export function useLibrary() {
  const catalogRef = useRef<Catalog | null>(null)
  const thumbUrls = useRef(new ThumbUrlCache())
  const [photos, setPhotos] = useState<LibraryPhoto[]>([])
  const [albums, setAlbums] = useState<AlbumRecord[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string>()
  const [progress, setProgress] = useState<{ done: number; total: number }>()
  const [importErrors, setImportErrors] = useState<string[]>([])

  const refresh = useCallback(async () => {
    const catalog = catalogRef.current
    if (!catalog) return
    const [list, albumList] = await Promise.all([catalog.list(), catalog.listAlbums()])
    const cache = thumbUrls.current
    const next = list.map((p) => ({ ...p, thumbUrl: cache.get(p.id, p.thumb) }))
    cache.prune(list.map((p) => p.id))
    setAlbums(albumList)
    setPhotos(next)
  }, [])

  useEffect(() => {
    let cancelled = false
    const cache = thumbUrls.current
    openCatalog()
      .then(async (catalog) => {
        if (cancelled) return catalog.close()
        catalogRef.current = catalog
        await refresh()
        setReady(true)
        // Ask the browser not to evict the catalog under storage pressure.
        navigator.storage?.persist?.().catch(() => {})
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not open the catalog'))
    return () => {
      cancelled = true
      catalogRef.current?.close()
      catalogRef.current = null
      cache.clear()
    }
  }, [refresh])

  const importFiles = useCallback(
    async (files: File[], albumId?: string) => {
      const catalog = catalogRef.current
      if (!catalog || files.length === 0) return
      setImportErrors([])
      setProgress({ done: 0, total: files.length })
      try {
        const summary = await importPhotos(files, catalog, (done, total) => setProgress({ done, total }), albumId)
        setImportErrors(summary.errors)
      } finally {
        setProgress(undefined)
        await refresh()
      }
    },
    [refresh],
  )

  const updatePhotos = useCallback(
    async (ids: string[], change: (photo: PhotoRecord) => PhotoRecord) => {
      await catalogRef.current?.update(ids, change)
      await refresh()
    },
    [refresh],
  )

  const getOriginal = useCallback((id: string) => catalogRef.current?.getOriginal(id) ?? Promise.resolve(undefined), [])

  const saveEdits = useCallback(
    async (id: string, edits: EditSettings, thumb: Blob) => {
      await catalogRef.current?.update([id], (p) => ({
        ...p,
        edits: isDefaultEdits(edits) ? undefined : edits,
        thumb,
      }))
      thumbUrls.current.replace(id)
      await refresh()
    },
    [refresh],
  )

  const removePhotos = useCallback(
    async (ids: string[]) => {
      for (const id of ids) await catalogRef.current?.remove(id)
      await refresh()
    },
    [refresh],
  )

  const createAlbum = useCallback(
    async (name: string) => {
      if (!name.trim()) return undefined
      const album = await catalogRef.current?.createAlbum(name)
      await refresh()
      return album
    },
    [refresh],
  )

  const renameAlbum = useCallback(
    async (id: string, name: string) => {
      if (!name.trim()) return
      await catalogRef.current?.renameAlbum(id, name)
      await refresh()
    },
    [refresh],
  )

  const deleteAlbum = useCallback(
    async (id: string) => {
      await catalogRef.current?.deleteAlbum(id)
      await refresh()
    },
    [refresh],
  )

  return {
    photos,
    albums,
    ready,
    error,
    progress,
    importErrors,
    importFiles,
    updatePhotos,
    getOriginal,
    saveEdits,
    removePhotos,
    createAlbum,
    renameAlbum,
    deleteAlbum,
  }
}
