import { describe, expect, it } from 'vitest'
import type { PhotoRecord } from './catalog'
import { addTag, emptyFilter, filterPhotos, isFiltering, normalizeTag, tagCounts } from './filter'

const p = (id: string, extra: Partial<PhotoRecord> = {}): PhotoRecord => ({
  id,
  name: `${id}.jpg`,
  size: 1,
  type: 'image/jpeg',
  addedAt: 0,
  thumb: new Blob(),
  rating: 0,
  favorite: false,
  tags: [],
  albumIds: [],
  ...extra,
})

const ids = (list: PhotoRecord[]) => list.map((x) => x.id)

describe('filterPhotos', () => {
  const photos = [
    p('a', { addedAt: 1, rating: 5, favorite: true, tags: ['beach', 'trip'], albumIds: ['x'], model: 'EOS R6' }),
    p('b', { addedAt: 2, rating: 3, tags: ['beach'] }),
    p('c', { addedAt: 3, rating: 1, takenAt: 100, tags: ['city'], albumIds: ['x', 'y'] }),
  ]

  it('returns everything newest-added first by default', () => {
    expect(ids(filterPhotos(photos, emptyFilter))).toEqual(['c', 'b', 'a'])
  })

  it('filters by album', () => {
    expect(ids(filterPhotos(photos, { ...emptyFilter, albumId: 'x' }))).toEqual(['c', 'a'])
    expect(ids(filterPhotos(photos, { ...emptyFilter, albumId: 'y' }))).toEqual(['c'])
  })

  it('requires all selected tags', () => {
    expect(ids(filterPhotos(photos, { ...emptyFilter, tags: ['beach'] }))).toEqual(['b', 'a'])
    expect(ids(filterPhotos(photos, { ...emptyFilter, tags: ['beach', 'trip'] }))).toEqual(['a'])
  })

  it('filters by minimum rating and favorites', () => {
    expect(ids(filterPhotos(photos, { ...emptyFilter, minRating: 3 }))).toEqual(['b', 'a'])
    expect(ids(filterPhotos(photos, { ...emptyFilter, favoritesOnly: true }))).toEqual(['a'])
  })

  it('searches name, camera and tags case-insensitively', () => {
    expect(ids(filterPhotos(photos, { ...emptyFilter, query: 'r6' }))).toEqual(['a'])
    expect(ids(filterPhotos(photos, { ...emptyFilter, query: 'CITY' }))).toEqual(['c'])
    expect(ids(filterPhotos(photos, { ...emptyFilter, query: 'b.jpg' }))).toEqual(['b'])
  })

  it('sorts by date taken, falling back to date added', () => {
    expect(ids(filterPhotos(photos, { ...emptyFilter, sort: 'taken' }))).toEqual(['c', 'b', 'a'])
  })

  it('combines filters', () => {
    expect(ids(filterPhotos(photos, { ...emptyFilter, albumId: 'x', minRating: 3 }))).toEqual(['a'])
  })
})

describe('isFiltering', () => {
  it('ignores sort and album, detects the rest', () => {
    expect(isFiltering({ ...emptyFilter, sort: 'taken', albumId: 'x' })).toBe(false)
    expect(isFiltering({ ...emptyFilter, query: ' ' })).toBe(false)
    expect(isFiltering({ ...emptyFilter, favoritesOnly: true })).toBe(true)
  })
})

describe('tags', () => {
  it('normalizes whitespace and case', () => {
    expect(normalizeTag('  Big   Sur ')).toBe('big sur')
  })

  it('adds a tag once and ignores blanks', () => {
    expect(addTag(['a'], ' B ')).toEqual(['a', 'b'])
    expect(addTag(['a'], 'A')).toEqual(['a'])
    expect(addTag(['a'], '   ')).toEqual(['a'])
  })

  it('counts tags, most used first', () => {
    expect(tagCounts([p('1', { tags: ['x', 'y'] }), p('2', { tags: ['y'] })])).toEqual([
      { tag: 'y', count: 2 },
      { tag: 'x', count: 1 },
    ])
  })
})
