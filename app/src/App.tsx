import { useEffect, useMemo, useRef, useState } from 'react'
import { detectInBrowser } from './capabilities'
import { addTag, emptyFilter, filterPhotos, isFiltering, tagCounts, type Filter } from './filter'
import { PhotoDetail } from './PhotoDetail'
import { useLibrary } from './useLibrary'
import './App.css'

function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function App() {
  const lib = useLibrary()
  const { photos, albums, ready, error, progress, importErrors } = lib
  const [filter, setFilter] = useState<Filter>(emptyFilter)
  const [selectedId, setSelectedId] = useState<string>()
  const [selecting, setSelecting] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [bulkTag, setBulkTag] = useState('')
  const [storage, setStorage] = useState<string>()
  const inputRef = useRef<HTMLInputElement>(null)
  const caps = useMemo(() => detectInBrowser(), [])

  const tags = useMemo(() => tagCounts(photos), [photos])
  const activeAlbum = albums.find((a) => a.id === filter.albumId)
  // A deleted album must not leave the view filtered by a ghost id.
  const visible = useMemo(
    () => filterPhotos(photos, { ...filter, albumId: activeAlbum?.id }),
    [photos, filter, activeAlbum?.id],
  )
  const detailPhoto = photos.find((p) => p.id === selectedId)
  const set = (patch: Partial<Filter>) => setFilter((f) => ({ ...f, ...patch }))

  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then(({ usage = 0, quota = 0 }) => setStorage(`${formatBytes(usage)} used of ${formatBytes(quota)}`))
      .catch(() => {})
  }, [photos])

  const toggleChecked = (id: string) =>
    setChecked((old) => {
      const next = new Set(old)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const stopSelecting = () => {
    setSelecting(false)
    setChecked(new Set())
  }

  const checkedIds = [...checked]

  const addAlbum = async () => {
    const name = window.prompt('Album name')
    if (!name) return
    const album = await lib.createAlbum(name)
    if (album) set({ albumId: album.id })
  }

  const doImport = (files: File[]) => lib.importFiles(files, activeAlbum?.id)

  return (
    <main
      className="library"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        doImport([...e.dataTransfer.files].filter((f) => f.type.startsWith('image/')))
      }}
    >
      <header>
        <h1>Photo Studio</h1>
        <div className="header-actions">
          <button
            type="button"
            aria-pressed={selecting}
            disabled={photos.length === 0}
            onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
          >
            {selecting ? 'Done' : 'Select'}
          </button>
          <button type="button" className="primary" disabled={!ready || !!progress} onClick={() => inputRef.current?.click()}>
            Import
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            doImport([...(e.target.files ?? [])])
            e.target.value = ''
          }}
        />
      </header>

      {error && <p role="alert" className="error">{error}</p>}
      {progress && (
        <p role="status">
          Importing {progress.done} of {progress.total}…
        </p>
      )}
      {importErrors.length > 0 && (
        <ul className="error" role="alert">
          {importErrors.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}

      {ready && photos.length > 0 && (
        <>
          <nav className="albums" aria-label="Albums">
            <button type="button" aria-pressed={!filter.albumId} onClick={() => set({ albumId: undefined })}>
              All photos
            </button>
            {albums.map((a) => (
              <button key={a.id} type="button" aria-pressed={filter.albumId === a.id} onClick={() => set({ albumId: a.id })}>
                {a.name}
              </button>
            ))}
            <button type="button" onClick={addAlbum}>
              + Album
            </button>
          </nav>

          {activeAlbum && (
            <p className="album-tools">
              <button
                type="button"
                onClick={() => {
                  const name = window.prompt('Rename album', activeAlbum.name)
                  if (name) lib.renameAlbum(activeAlbum.id, name)
                }}
              >
                Rename album
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  if (window.confirm(`Delete album “${activeAlbum.name}”? Its photos stay in your library.`)) {
                    lib.deleteAlbum(activeAlbum.id)
                  }
                }}
              >
                Delete album
              </button>
            </p>
          )}

          <section className="filters" aria-label="Search and filter">
            <input
              type="search"
              placeholder="Search name, camera or tag"
              aria-label="Search"
              value={filter.query}
              onChange={(e) => set({ query: e.target.value })}
            />
            <select aria-label="Minimum rating" value={filter.minRating} onChange={(e) => set({ minRating: Number(e.target.value) })}>
              <option value={0}>Any rating</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}★ and up
                </option>
              ))}
            </select>
            <select aria-label="Sort" value={filter.sort} onChange={(e) => set({ sort: e.target.value as Filter['sort'] })}>
              <option value="added">Date added</option>
              <option value="taken">Date taken</option>
            </select>
            <button type="button" aria-pressed={filter.favoritesOnly} onClick={() => set({ favoritesOnly: !filter.favoritesOnly })}>
              ♥ Favorites
            </button>
            {isFiltering(filter) && (
              <button type="button" onClick={() => setFilter((f) => ({ ...emptyFilter, albumId: f.albumId, sort: f.sort }))}>
                Clear
              </button>
            )}
          </section>

          {tags.length > 0 && (
            <ul className="chips" aria-label="Filter by tag">
              {tags.slice(0, 12).map(({ tag, count }) => (
                <li key={tag}>
                  <button
                    type="button"
                    aria-pressed={filter.tags.includes(tag)}
                    onClick={() =>
                      set({ tags: filter.tags.includes(tag) ? filter.tags.filter((t) => t !== tag) : [...filter.tags, tag] })
                    }
                  >
                    {tag} · {count}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {ready && photos.length === 0 && !progress && (
        <p className="empty">No photos yet. Tap “Import” or drop images here.</p>
      )}
      {ready && photos.length > 0 && visible.length === 0 && (
        <p className="empty">No photos match. Try clearing the filters.</p>
      )}

      <ul className="grid">
        {visible.map((p) => (
          <li key={p.id} className={checked.has(p.id) ? 'checked' : undefined}>
            <button
              type="button"
              onClick={() => (selecting ? toggleChecked(p.id) : setSelectedId(p.id))}
              aria-label={`${selecting ? 'Select' : 'Open'} ${p.name}`}
              aria-pressed={selecting ? checked.has(p.id) : undefined}
            >
              <img src={p.thumbUrl} alt={p.name} loading="lazy" />
              {(p.favorite || p.rating > 0) && (
                <span className="badge">
                  {p.favorite ? '♥' : ''}
                  {p.rating > 0 ? `${p.rating}★` : ''}
                </span>
              )}
              {selecting && <span className="tick">{checked.has(p.id) ? '✓' : ''}</span>}
            </button>
          </li>
        ))}
      </ul>

      {selecting && (
        <div className="bulk" role="toolbar" aria-label="Selection actions">
          <span>{checked.size} selected</span>
          <button type="button" onClick={() => setChecked(new Set(visible.map((p) => p.id)))}>
            All
          </button>
          <button
            type="button"
            disabled={checked.size === 0}
            onClick={() => lib.updatePhotos(checkedIds, (p) => ({ ...p, favorite: true }))}
          >
            ♥
          </button>
          <select
            aria-label="Add to album"
            disabled={checked.size === 0 || albums.length === 0}
            value=""
            onChange={(e) => {
              const id = e.target.value
              lib.updatePhotos(checkedIds, (p) => ({ ...p, albumIds: p.albumIds.includes(id) ? p.albumIds : [...p.albumIds, id] }))
            }}
          >
            <option value="">+ Album</option>
            {albums.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              lib.updatePhotos(checkedIds, (p) => ({ ...p, tags: addTag(p.tags, bulkTag) }))
              setBulkTag('')
            }}
          >
            <input
              value={bulkTag}
              onChange={(e) => setBulkTag(e.target.value)}
              placeholder="Tag"
              aria-label="Tag selected photos"
              disabled={checked.size === 0}
            />
          </form>
          {activeAlbum && (
            <button
              type="button"
              disabled={checked.size === 0}
              onClick={() => lib.updatePhotos(checkedIds, (p) => ({ ...p, albumIds: p.albumIds.filter((a) => a !== activeAlbum.id) }))}
            >
              Remove from album
            </button>
          )}
          <button
            type="button"
            className="danger"
            disabled={checked.size === 0}
            onClick={async () => {
              if (window.confirm(`Delete ${checked.size} photo${checked.size === 1 ? '' : 's'}? This can't be undone.`)) {
                await lib.removePhotos(checkedIds)
                stopSelecting()
              }
            }}
          >
            Delete
          </button>
        </div>
      )}

      {detailPhoto && (
        <PhotoDetail
          photo={detailPhoto}
          albums={albums}
          knownTags={tags.map((t) => t.tag)}
          onChange={(change) => lib.updatePhotos([detailPhoto.id], change)}
          onCreateAlbum={lib.createAlbum}
          onDelete={() => {
            if (window.confirm('Delete this photo? This can’t be undone.')) {
              lib.removePhotos([detailPhoto.id])
              setSelectedId(undefined)
            }
          }}
          onClose={() => setSelectedId(undefined)}
        />
      )}

      <footer>
        <p>
          {ready
            ? `${visible.length}${visible.length === photos.length ? '' : ` of ${photos.length}`} photo${photos.length === 1 ? '' : 's'}`
            : 'Loading…'}
          {storage ? ` · ${storage}` : ''}
        </p>
        <details>
          <summary>Browser check</summary>
          <ul>
            {caps.map((c) => (
              <li key={c.key}>
                {c.supported ? '✅' : '❌'} {c.label}
              </li>
            ))}
          </ul>
          <p className="ua">{navigator.userAgent}</p>
        </details>
      </footer>
    </main>
  )
}

export default App
