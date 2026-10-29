import type { PhotoRecord } from './catalog'

export type SortKey = 'added' | 'taken'

export type Filter = {
  query: string
  tags: string[]
  albumId?: string
  minRating: number
  favoritesOnly: boolean
  sort: SortKey
}

export const emptyFilter: Filter = {
  query: '',
  tags: [],
  minRating: 0,
  favoritesOnly: false,
  sort: 'added',
}

export const isFiltering = (f: Filter) =>
  f.query.trim() !== '' || f.tags.length > 0 || f.minRating > 0 || f.favoritesOnly

export function normalizeTag(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function filterPhotos<T extends PhotoRecord>(photos: T[], f: Filter): T[] {
  const q = f.query.trim().toLowerCase()
  const result = photos.filter((p) => {
    if (f.albumId && !p.albumIds.includes(f.albumId)) return false
    if (f.favoritesOnly && !p.favorite) return false
    if (p.rating < f.minRating) return false
    if (!f.tags.every((t) => p.tags.includes(t))) return false
    if (q) {
      const haystack = [p.name, p.make, p.model, ...p.tags].filter(Boolean).join(' ').toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
  const key = (p: T) => (f.sort === 'taken' ? (p.takenAt ?? p.addedAt) : p.addedAt)
  return result.sort((a, b) => key(b) - key(a))
}

export function tagCounts(photos: PhotoRecord[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const p of photos) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

export function addTag(tags: string[], raw: string): string[] {
  const tag = normalizeTag(raw)
  return tag && !tags.includes(tag) ? [...tags, tag] : tags
}
