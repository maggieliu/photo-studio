import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { beforeEach, describe, expect, it } from 'vitest'
import { openCatalog, type PhotoRecord } from './catalog'

const photo = (id: string, addedAt: number): PhotoRecord => ({
  id,
  name: `${id}.jpg`,
  size: 3,
  type: 'image/jpeg',
  addedAt,
  thumb: new Blob(['t']),
  rating: 0,
  favorite: false,
  tags: [],
  albumIds: [],
})

let n = 0
beforeEach(() => {
  n++
})

describe('catalog', () => {
  it('stores photos and lists newest first', async () => {
    const c = await openCatalog(`test-${n}`)
    await c.add(photo('a', 1), new Blob(['aaa']))
    await c.add(photo('b', 2), new Blob(['bbb']))
    expect((await c.list()).map((p) => p.id)).toEqual(['b', 'a'])
    expect(await c.count()).toBe(2)
    c.close()
  })

  it('persists across reopen and returns the original blob', async () => {
    const name = `test-${n}`
    const c1 = await openCatalog(name)
    await c1.add(photo('a', 1), new Blob(['aaa']))
    c1.close()

    const c2 = await openCatalog(name)
    expect(await c2.count()).toBe(1)
    const original = await c2.getOriginal('a')
    expect(original?.size).toBe(3)
    c2.close()
  })

  it('removes the photo and its original', async () => {
    const c = await openCatalog(`test-${n}`)
    await c.add(photo('a', 1), new Blob(['aaa']))
    await c.remove('a')
    expect(await c.count()).toBe(0)
    expect(await c.getOriginal('a')).toBeUndefined()
    c.close()
  })

  it('updates several photos at once and ignores missing ids', async () => {
    const c = await openCatalog(`test-${n}`)
    await c.add(photo('a', 1), new Blob())
    await c.add(photo('b', 2), new Blob())
    await c.update(['a', 'b', 'missing'], (p) => ({ ...p, rating: 4, tags: ['x'] }))
    const list = await c.list()
    expect(list.map((p) => [p.rating, p.tags])).toEqual([
      [4, ['x']],
      [4, ['x']],
    ])
    expect(await c.count()).toBe(2)
    c.close()
  })

  it('creates, renames and lists albums in creation order', async () => {
    const c = await openCatalog(`test-${n}`)
    const first = await c.createAlbum('  Trip ')
    await new Promise((r) => setTimeout(r, 2))
    await c.createAlbum('Family')
    await c.renameAlbum(first.id, 'Italy')
    expect((await c.listAlbums()).map((a) => a.name)).toEqual(['Italy', 'Family'])
    c.close()
  })

  it('deleting an album removes it from photos but keeps the photos', async () => {
    const c = await openCatalog(`test-${n}`)
    const album = await c.createAlbum('Trip')
    await c.add({ ...photo('a', 1), albumIds: [album.id, 'other'] }, new Blob())
    await c.deleteAlbum(album.id)
    expect(await c.listAlbums()).toEqual([])
    expect((await c.list())[0].albumIds).toEqual(['other'])
    c.close()
  })

  it('migrates a version 1 catalog and fills in defaults', async () => {
    const name = `test-${n}`
    const v1 = await openDB(name, 1, {
      upgrade(db) {
        db.createObjectStore('photos', { keyPath: 'id' }).createIndex('by-added', 'addedAt')
        db.createObjectStore('originals', { keyPath: 'id' })
      },
    })
    await v1.put('photos', { id: 'old', name: 'old.jpg', size: 1, type: 'image/jpeg', addedAt: 1, thumb: new Blob() })
    v1.close()

    const c = await openCatalog(name)
    const [old] = await c.list()
    expect(old).toMatchObject({ id: 'old', rating: 0, favorite: false, tags: [], albumIds: [] })
    expect(await c.listAlbums()).toEqual([])
    c.close()
  })
})
