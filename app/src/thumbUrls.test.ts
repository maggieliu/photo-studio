import { describe, expect, it, vi } from 'vitest'
import { ThumbUrlCache } from './thumbUrls'

const setup = () => {
  const revoked: string[] = []
  let n = 0
  const cache = new ThumbUrlCache(
    () => `blob:${++n}`,
    (u) => revoked.push(u),
  )
  return { cache, revoked }
}

describe('ThumbUrlCache', () => {
  it('returns the same url for the same photo, even with a fresh blob', () => {
    const { cache, revoked } = setup()
    const first = cache.get('a', new Blob(['1']))
    expect(cache.get('a', new Blob(['1']))).toBe(first)
    expect(revoked).toEqual([])
  })

  it('creates distinct urls for different photos', () => {
    const { cache } = setup()
    expect(cache.get('a', new Blob())).not.toBe(cache.get('b', new Blob()))
  })

  it('revokes only the urls of photos that are gone', () => {
    const { cache, revoked } = setup()
    const a = cache.get('a', new Blob())
    cache.get('b', new Blob())
    cache.prune(['b'])
    expect(revoked).toEqual([a])
  })

  it('replace hands out a new url and revokes the old one later', () => {
    vi.useFakeTimers()
    const { cache, revoked } = setup()
    const old = cache.get('a', new Blob())
    cache.replace('a', 1000)
    expect(cache.get('a', new Blob())).not.toBe(old)
    expect(revoked).toEqual([])
    vi.advanceTimersByTime(1000)
    expect(revoked).toEqual([old])
    vi.useRealTimers()
  })

  it('clear revokes everything', () => {
    const { cache, revoked } = setup()
    cache.get('a', new Blob())
    cache.get('b', new Blob())
    cache.clear()
    expect(revoked).toHaveLength(2)
  })
})
