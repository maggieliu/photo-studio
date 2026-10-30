import { useState } from 'react'
import type { AlbumRecord, PhotoRecord } from './catalog'
import { addTag } from './filter'
import { StarRating } from './StarRating'
import type { LibraryPhoto } from './useLibrary'

type Props = {
  photo: LibraryPhoto
  albums: AlbumRecord[]
  knownTags: string[]
  onChange: (change: (photo: PhotoRecord) => PhotoRecord) => void
  onCreateAlbum: (name: string) => Promise<AlbumRecord | undefined>
  onDelete: () => void
  onEdit: () => void
  onExport: () => void
  onClose: () => void
}

function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function PhotoDetail({ photo, albums, knownTags, onChange, onCreateAlbum, onDelete, onEdit, onExport, onClose }: Props) {
  const [tagInput, setTagInput] = useState('')
  const [albumInput, setAlbumInput] = useState('')

  const submitTag = () => {
    onChange((p) => ({ ...p, tags: addTag(p.tags, tagInput) }))
    setTagInput('')
  }

  const toggleAlbum = (id: string, member: boolean) =>
    onChange((p) => ({
      ...p,
      albumIds: member ? p.albumIds.filter((a) => a !== id) : [...p.albumIds, id],
    }))

  const submitAlbum = async () => {
    const album = await onCreateAlbum(albumInput)
    setAlbumInput('')
    if (album) onChange((p) => ({ ...p, albumIds: [...p.albumIds, album.id] }))
  }

  return (
    <dialog open className="detail" aria-label="Photo details">
      <img src={photo.thumbUrl} alt={photo.name} />

      <div className="row">
        <StarRating value={photo.rating} onChange={(rating) => onChange((p) => ({ ...p, rating }))} />
        <button
          type="button"
          className={`heart${photo.favorite ? ' on' : ''}`}
          aria-pressed={photo.favorite}
          aria-label="Favorite"
          onClick={() => onChange((p) => ({ ...p, favorite: !p.favorite }))}
        >
          {photo.favorite ? '♥' : '♡'}
        </button>
      </div>

      <h3>Tags</h3>
      <ul className="chips">
        {photo.tags.map((t) => (
          <li key={t}>
            <button
              type="button"
              aria-label={`Remove tag ${t}`}
              onClick={() => onChange((p) => ({ ...p, tags: p.tags.filter((x) => x !== t) }))}
            >
              {t} ×
            </button>
          </li>
        ))}
      </ul>
      <form
        className="inline"
        onSubmit={(e) => {
          e.preventDefault()
          submitTag()
        }}
      >
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          placeholder="Add tag"
          list="known-tags"
          aria-label="Add tag"
        />
        <datalist id="known-tags">
          {knownTags.filter((t) => !photo.tags.includes(t)).map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <button type="submit">Add</button>
      </form>

      <h3>Albums</h3>
      <ul className="checks">
        {albums.map((a) => {
          const member = photo.albumIds.includes(a.id)
          return (
            <li key={a.id}>
              <label>
                <input type="checkbox" checked={member} onChange={() => toggleAlbum(a.id, member)} /> {a.name}
              </label>
            </li>
          )
        })}
      </ul>
      <form
        className="inline"
        onSubmit={(e) => {
          e.preventDefault()
          submitAlbum()
        }}
      >
        <input
          value={albumInput}
          onChange={(e) => setAlbumInput(e.target.value)}
          placeholder="New album"
          aria-label="New album name"
        />
        <button type="submit">Create</button>
      </form>

      <dl>
        <dt>Name</dt>
        <dd>{photo.name}</dd>
        <dt>Size</dt>
        <dd>
          {formatBytes(photo.size)}
          {photo.width && photo.height ? ` · ${photo.width}×${photo.height}` : ''}
        </dd>
        {photo.takenAt && (
          <>
            <dt>Taken</dt>
            <dd>{new Date(photo.takenAt).toLocaleString()}</dd>
          </>
        )}
        {(photo.make || photo.model) && (
          <>
            <dt>Camera</dt>
            <dd>{[photo.make, photo.model].filter(Boolean).join(' ')}</dd>
          </>
        )}
      </dl>

      <div className="actions">
        <button type="button" className="danger" onClick={onDelete}>
          Delete
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
        <button type="button" onClick={onExport}>
          Export
        </button>
        <button type="button" className="primary" onClick={onEdit}>
          Edit
        </button>
      </div>
    </dialog>
  )
}
