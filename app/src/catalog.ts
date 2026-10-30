import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { EditSettings } from './edits'

export type PhotoRecord = {
  id: string
  name: string
  size: number
  type: string
  addedAt: number
  takenAt?: number
  make?: string
  model?: string
  width?: number
  height?: number
  thumb: Blob
  rating: number
  favorite: boolean
  tags: string[]
  albumIds: string[]
  /** Absent until the photo is edited. The original file is never changed. */
  edits?: EditSettings
}

export type AlbumRecord = {
  id: string
  name: string
  createdAt: number
}

interface CatalogDB extends DBSchema {
  photos: {
    key: string
    value: PhotoRecord
    indexes: { 'by-added': number }
  }
  originals: {
    key: string
    value: { id: string; blob: Blob }
  }
  albums: {
    key: string
    value: AlbumRecord
  }
}

export type Catalog = {
  add(photo: PhotoRecord, original: Blob): Promise<void>
  list(): Promise<PhotoRecord[]>
  getOriginal(id: string): Promise<Blob | undefined>
  update(ids: string[], change: (photo: PhotoRecord) => PhotoRecord): Promise<void>
  remove(id: string): Promise<void>
  count(): Promise<number>
  listAlbums(): Promise<AlbumRecord[]>
  createAlbum(name: string): Promise<AlbumRecord>
  renameAlbum(id: string, name: string): Promise<void>
  deleteAlbum(id: string): Promise<void>
  close(): void
}

// Photos saved before Phase 2 lack the organizing fields.
const normalize = (p: PhotoRecord): PhotoRecord => ({
  ...p,
  rating: p.rating ?? 0,
  favorite: p.favorite ?? false,
  tags: p.tags ?? [],
  albumIds: p.albumIds ?? [],
})

export async function openCatalog(name = 'photo-studio'): Promise<Catalog> {
  const db: IDBPDatabase<CatalogDB> = await openDB<CatalogDB>(name, 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const photos = db.createObjectStore('photos', { keyPath: 'id' })
        photos.createIndex('by-added', 'addedAt')
        db.createObjectStore('originals', { keyPath: 'id' })
      }
      if (oldVersion < 2) {
        db.createObjectStore('albums', { keyPath: 'id' })
      }
    },
  })

  return {
    async add(photo, original) {
      const tx = db.transaction(['photos', 'originals'], 'readwrite')
      await Promise.all([
        tx.objectStore('photos').put(photo),
        tx.objectStore('originals').put({ id: photo.id, blob: original }),
        tx.done,
      ])
    },
    async list() {
      const all = await db.getAllFromIndex('photos', 'by-added')
      return all.reverse().map(normalize)
    },
    async getOriginal(id) {
      return (await db.get('originals', id))?.blob
    },
    async update(ids, change) {
      const tx = db.transaction('photos', 'readwrite')
      for (const id of ids) {
        const photo = await tx.store.get(id)
        if (photo) await tx.store.put({ ...change(normalize(photo)), id })
      }
      await tx.done
    },
    async remove(id) {
      const tx = db.transaction(['photos', 'originals'], 'readwrite')
      await Promise.all([
        tx.objectStore('photos').delete(id),
        tx.objectStore('originals').delete(id),
        tx.done,
      ])
    },
    count: () => db.count('photos'),
    async listAlbums() {
      const all = await db.getAll('albums')
      return all.sort((a, b) => a.createdAt - b.createdAt)
    },
    async createAlbum(albumName) {
      const album: AlbumRecord = { id: crypto.randomUUID(), name: albumName.trim(), createdAt: Date.now() }
      await db.put('albums', album)
      return album
    },
    async renameAlbum(id, albumName) {
      const album = await db.get('albums', id)
      if (album) await db.put('albums', { ...album, name: albumName.trim() })
    },
    async deleteAlbum(id) {
      const tx = db.transaction(['albums', 'photos'], 'readwrite')
      await tx.objectStore('albums').delete(id)
      for (const photo of await tx.objectStore('photos').getAll()) {
        if (photo.albumIds?.includes(id)) {
          await tx.objectStore('photos').put({ ...photo, albumIds: photo.albumIds.filter((a) => a !== id) })
        }
      }
      await tx.done
    },
    close: () => db.close(),
  }
}
