import { useCallback, useEffect, useRef, useState } from 'react'
import { openCatalog, type Catalog, type PhotoRecord } from './catalog'
import { importPhotos } from './importPhoto'

export type LibraryPhoto = PhotoRecord & { thumbUrl: string }

const withUrl = (p: PhotoRecord): LibraryPhoto => ({ ...p, thumbUrl: URL.createObjectURL(p.thumb) })

export function useLibrary() {
  const catalogRef = useRef<Catalog | null>(null)
  const [photos, setPhotos] = useState<LibraryPhoto[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string>()
  const [progress, setProgress] = useState<{ done: number; total: number }>()
  const [importErrors, setImportErrors] = useState<string[]>([])

  const refresh = useCallback(async () => {
    const catalog = catalogRef.current
    if (!catalog) return
    const list = await catalog.list()
    setPhotos((old) => {
      old.forEach((p) => URL.revokeObjectURL(p.thumbUrl))
      return list.map(withUrl)
    })
  }, [])

  useEffect(() => {
    let cancelled = false
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
    }
  }, [refresh])

  const importFiles = useCallback(
    async (files: File[]) => {
      const catalog = catalogRef.current
      if (!catalog || files.length === 0) return
      setImportErrors([])
      setProgress({ done: 0, total: files.length })
      try {
        const summary = await importPhotos(files, catalog, (done, total) => setProgress({ done, total }))
        setImportErrors(summary.errors)
      } finally {
        setProgress(undefined)
        await refresh()
      }
    },
    [refresh],
  )

  const remove = useCallback(
    async (id: string) => {
      await catalogRef.current?.remove(id)
      await refresh()
    },
    [refresh],
  )

  return { photos, ready, error, progress, importErrors, importFiles, remove }
}
