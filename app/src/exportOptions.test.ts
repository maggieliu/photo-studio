import { describe, expect, it } from 'vitest'
import {
  defaultExportOptions,
  exportFileName,
  MAX_EXPORT_PIXELS,
  normalizeExportOptions,
  planExportSize,
} from './exportOptions'

describe('normalizeExportOptions', () => {
  it('falls back to defaults for junk', () => {
    expect(normalizeExportOptions(undefined)).toEqual(defaultExportOptions)
    expect(normalizeExportOptions('x')).toEqual(defaultExportOptions)
    expect(normalizeExportOptions({ format: 'gif', quality: 'high', size: -5 })).toEqual(defaultExportOptions)
  })

  it('keeps valid values and clamps the rest', () => {
    expect(normalizeExportOptions({ format: 'png', quality: 150, size: 2048 })).toEqual({
      format: 'png',
      quality: 100,
      size: 2048,
    })
    expect(normalizeExportOptions({ format: 'webp', quality: 0, size: 99999 })).toEqual({
      format: 'webp',
      quality: 1,
      size: 16384,
    })
    expect(normalizeExportOptions({ size: 'original' }).size).toBe('original')
  })
})

describe('exportFileName', () => {
  it('swaps the extension and marks edited photos', () => {
    expect(exportFileName('IMG_1.CR2', true, 'jpg', new Set())).toBe('IMG_1-edited.jpg')
    expect(exportFileName('IMG_1.CR2', false, 'png', new Set())).toBe('IMG_1.png')
  })

  it('keeps dots inside the name', () => {
    expect(exportFileName('trip.day.1.jpeg', false, 'jpg', new Set())).toBe('trip.day.1.jpg')
  })

  it('handles names without an extension', () => {
    expect(exportFileName('photo', false, 'jpg', new Set())).toBe('photo.jpg')
  })

  it('numbers duplicates, ignoring case', () => {
    const taken = new Set<string>()
    expect(exportFileName('a.jpg', false, 'jpg', taken)).toBe('a.jpg')
    expect(exportFileName('A.png', false, 'jpg', taken)).toBe('A-2.jpg')
    expect(exportFileName('a.heic', false, 'jpg', taken)).toBe('a-3.jpg')
  })
})

describe('planExportSize', () => {
  it('uses the full size for "original"', () => {
    expect(planExportSize(4000, 3000, 'original', 16384)).toEqual({ maxEdge: 4000, reduced: false })
  })

  it('scales down to a preset but never up', () => {
    expect(planExportSize(4000, 3000, 2048, 16384)).toEqual({ maxEdge: 2048, reduced: false })
    expect(planExportSize(1000, 800, 2048, 16384)).toEqual({ maxEdge: 1000, reduced: false })
  })

  it('caps by the texture limit and flags it', () => {
    expect(planExportSize(8000, 6000, 'original', 4096)).toEqual({ maxEdge: 4096, reduced: true })
  })

  it('caps by total pixels and flags it', () => {
    const plan = planExportSize(12000, 9000, 'original', 16384)
    expect(plan.reduced).toBe(true)
    expect(plan.maxEdge).toBeLessThan(12000)
    const w = plan.maxEdge
    const h = Math.round((plan.maxEdge * 9000) / 12000)
    expect(w * h).toBeLessThanOrEqual(MAX_EXPORT_PIXELS)
  })

  it('does not flag a preset that is small enough', () => {
    expect(planExportSize(12000, 9000, 1080, 16384).reduced).toBe(false)
  })
})
