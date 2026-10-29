import { useEffect, useMemo, useRef, useState } from 'react'
import { detectInBrowser } from './capabilities'
import { useLibrary } from './useLibrary'
import './App.css'

function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function App() {
  const { photos, ready, error, progress, importErrors, importFiles, remove } = useLibrary()
  const [selectedId, setSelectedId] = useState<string>()
  const [storage, setStorage] = useState<string>()
  const inputRef = useRef<HTMLInputElement>(null)
  const caps = useMemo(() => detectInBrowser(), [])
  const selected = photos.find((p) => p.id === selectedId)

  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then(({ usage = 0, quota = 0 }) => setStorage(`${formatBytes(usage)} used of ${formatBytes(quota)}`))
      .catch(() => {})
  }, [photos])

  return (
    <main
      className="library"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        importFiles([...e.dataTransfer.files].filter((f) => f.type.startsWith('image/')))
      }}
    >
      <header>
        <h1>Photo Studio</h1>
        <button type="button" className="primary" disabled={!ready || !!progress} onClick={() => inputRef.current?.click()}>
          Import photos
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            importFiles([...(e.target.files ?? [])])
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

      {ready && photos.length === 0 && !progress && (
        <p className="empty">No photos yet. Tap “Import photos” or drop images here.</p>
      )}

      <ul className="grid">
        {photos.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => setSelectedId(p.id)} aria-label={`Open ${p.name}`}>
              <img src={p.thumbUrl} alt={p.name} loading="lazy" />
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <dialog open className="detail" aria-label="Photo details">
          <img src={selected.thumbUrl} alt={selected.name} />
          <dl>
            <dt>Name</dt>
            <dd>{selected.name}</dd>
            <dt>Size</dt>
            <dd>
              {formatBytes(selected.size)}
              {selected.width && selected.height ? ` · ${selected.width}×${selected.height}` : ''}
            </dd>
            {selected.takenAt && (
              <>
                <dt>Taken</dt>
                <dd>{new Date(selected.takenAt).toLocaleString()}</dd>
              </>
            )}
            {(selected.make || selected.model) && (
              <>
                <dt>Camera</dt>
                <dd>{[selected.make, selected.model].filter(Boolean).join(' ')}</dd>
              </>
            )}
          </dl>
          <div className="actions">
            <button type="button" onClick={() => setSelectedId(undefined)}>
              Close
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => {
                remove(selected.id)
                setSelectedId(undefined)
              }}
            >
              Delete
            </button>
          </div>
        </dialog>
      )}

      <footer>
        <p>
          {ready ? `${photos.length} photo${photos.length === 1 ? '' : 's'}` : 'Loading…'}
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
