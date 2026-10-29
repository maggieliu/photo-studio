import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { openCatalog, type PhotoRecord } from './catalog'

const photo = (id: string, addedAt: number): PhotoRecord => ({
  id,
  name: `${id}.jpg`,
  size: 3,
  type: 'image/jpeg',
  addedAt,
  thumb: new Blob(['t']),
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
})
