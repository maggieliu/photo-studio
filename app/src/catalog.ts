import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

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
}

export type Catalog = {
  add(photo: PhotoRecord, original: Blob): Promise<void>
  list(): Promise<PhotoRecord[]>
  getOriginal(id: string): Promise<Blob | undefined>
  remove(id: string): Promise<void>
  count(): Promise<number>
  close(): void
}

export async function openCatalog(name = 'photo-studio'): Promise<Catalog> {
  const db: IDBPDatabase<CatalogDB> = await openDB<CatalogDB>(name, 1, {
    upgrade(db) {
      const photos = db.createObjectStore('photos', { keyPath: 'id' })
      photos.createIndex('by-added', 'addedAt')
      db.createObjectStore('originals', { keyPath: 'id' })
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
      return all.reverse()
    },
    async getOriginal(id) {
      return (await db.get('originals', id))?.blob
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
    close: () => db.close(),
  }
}
