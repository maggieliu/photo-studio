import { describe, expect, it } from 'vitest'
import { fitWithin, summarizeExif } from './imageMeta'

describe('fitWithin', () => {
  it('scales the long edge down to max', () => {
    expect(fitWithin(4000, 3000, 320)).toEqual({ width: 320, height: 240 })
    expect(fitWithin(3000, 4000, 320)).toEqual({ width: 240, height: 320 })
  })

  it('never upscales', () => {
    expect(fitWithin(100, 50, 320)).toEqual({ width: 100, height: 50 })
  })
})

describe('summarizeExif', () => {
  it('returns empty for missing data', () => {
    expect(summarizeExif(undefined)).toEqual({})
  })

  it('extracts date, make and model', () => {
    const d = new Date('2024-05-01T10:00:00Z')
    expect(summarizeExif({ DateTimeOriginal: d, Make: ' Canon ', Model: 'EOS R6' })).toEqual({
      takenAt: d.getTime(),
      make: 'Canon',
      model: 'EOS R6',
    })
  })

  it('ignores invalid dates and blank strings', () => {
    expect(summarizeExif({ DateTimeOriginal: new Date('nope'), Make: '  ' })).toEqual({
      takenAt: undefined,
      make: undefined,
      model: undefined,
    })
  })
})
