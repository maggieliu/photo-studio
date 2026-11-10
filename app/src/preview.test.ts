import { describe, expect, it, vi } from 'vitest'
import { defaultEdits } from './edits'
import { describePreviewError, PreviewUrlCache, previewKey } from './preview'
import { swipeDirection } from './swipe'

describe('previewKey', () => {
  it('changes when the edits change', () => {
    const a = previewKey({ id: 'x' })
    const b = previewKey({ id: 'x', edits: { ...defaultEdits, exposure: 10 } })
    expect(a).not.toBe(b)
    expect(previewKey({ id: 'x' })).toBe(a)
  })

  it('differs between photos', () => {
    expect(previewKey({ id: 'x' })).not.toBe(previewKey({ id: 'y' }))
  })
})

describe('PreviewUrlCache', () => {
  const setup = (max = 2) => {
    const revoked: string[] = []
    let n = 0
    const cache = new PreviewUrlCache(max, () => `blob:${++n}`, (u) => revoked.push(u), 1000)
    return { cache, revoked }
  }

  it('returns the same url for the same key', () => {
    const { cache } = setup()
    const first = cache.add('a', new Blob())
    expect(cache.add('a', new Blob())).toBe(first)
    expect(cache.get('a')).toBe(first)
    expect(cache.get('missing')).toBeUndefined()
  })

  it('drops the least recently used url, and releases it later', () => {
    vi.useFakeTimers()
    const { cache, revoked } = setup(2)
    const a = cache.add('a', new Blob())
    cache.add('b', new Blob())
    cache.get('a') // a is now newer than b
    cache.add('c', new Blob()) // evicts b
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('a')).toBe(a)
    expect(revoked).toEqual([])
    vi.advanceTimersByTime(1000)
    expect(revoked).toEqual(['blob:2'])
    vi.useRealTimers()
  })
})

describe('swipeDirection', () => {
  it('detects a clear sideways swipe', () => {
    expect(swipeDirection(-120, 10)).toBe('left')
    expect(swipeDirection(120, -20)).toBe('right')
  })

  it('ignores short moves and taps', () => {
    expect(swipeDirection(20, 0)).toBeUndefined()
    expect(swipeDirection(0, 0)).toBeUndefined()
  })

  it('ignores mostly vertical drags', () => {
    expect(swipeDirection(60, 80)).toBeUndefined()
    expect(swipeDirection(-70, 60)).toBeUndefined()
  })
})

describe('describePreviewError', () => {
  it('names the error and its message', () => {
    expect(describePreviewError(new Error('boom'))).toBe('Error: boom')
    expect(describePreviewError(new DOMException('no context', 'InvalidStateError'))).toBe('InvalidStateError: no context')
  })

  it('handles errors without a message and things that are not errors', () => {
    expect(describePreviewError(new RangeError(''))).toBe('RangeError')
    expect(describePreviewError('weird')).toBe('Unknown error')
  })
})
