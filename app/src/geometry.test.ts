import { describe, expect, it } from 'vitest'
import { defaultEdits, type EditSettings } from './edits'
import { applyAffine, compose, cropRect, outputSize, outputToSource, straightenScale } from './geometry'

const map = (edits: Partial<EditSettings>, x: number, y: number, w = 4, h = 2) =>
  applyAffine(outputToSource({ ...defaultEdits, ...edits }, w, h), x, y)

const close = (actual: number[], expected: number[]) =>
  actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 6))

describe('compose', () => {
  it('applies the inner transform first', () => {
    const scale = [2, 0, 0, 2, 0, 0] as const
    const shift = [1, 0, 0, 1, 10, 0] as const
    expect(applyAffine(compose(scale, shift), 1, 1)).toEqual([22, 2])
    expect(applyAffine(compose(shift, scale), 1, 1)).toEqual([12, 2])
  })
})

describe('outputToSource', () => {
  it('is the identity with default edits', () => {
    close(map({}, 0, 0), [0, 0])
    close(map({}, 1, 1), [1, 1])
    close(map({}, 0.25, 0.75), [0.25, 0.75])
  })

  it('flips horizontally', () => {
    close(map({ flipH: true }, 0, 0), [1, 0])
    close(map({ flipH: true }, 1, 1), [0, 1])
  })

  it('rotates a quarter turn clockwise', () => {
    // The top-left of the result is the bottom-left of the source.
    close(map({ rotation: 90 }, 0, 0), [0, 1])
    // The top-right of the result is the top-left of the source.
    close(map({ rotation: 90 }, 1, 0), [0, 0])
    close(map({ rotation: 90 }, 1, 1), [1, 0])
  })

  it('rotates a half turn', () => {
    close(map({ rotation: 180 }, 0, 0), [1, 1])
    close(map({ rotation: 180 }, 1, 1), [0, 0])
  })

  it('three quarter turns is one turn the other way', () => {
    close(map({ rotation: 270 }, 0, 0), [1, 0])
    close(map({ rotation: 270 }, 1, 0), [1, 1])
  })

  it('keeps the centre fixed when straightening', () => {
    close(map({ straighten: 12 }, 0.5, 0.5), [0.5, 0.5])
  })

  it('never samples outside the source when straightened', () => {
    for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const [u, v] = map({ straighten: 10 }, x, y, 3, 2)
      expect(u).toBeGreaterThanOrEqual(-1e-9)
      expect(u).toBeLessThanOrEqual(1 + 1e-9)
      expect(v).toBeGreaterThanOrEqual(-1e-9)
      expect(v).toBeLessThanOrEqual(1 + 1e-9)
    }
  })

  it('maps through a centred square crop', () => {
    const crop = { aspect: 1, zoom: 1, px: 0.5, py: 0.5 }
    // 4×2 source, square crop covers the middle 2×2: x from 0.25 to 0.75.
    close(map({ crop }, 0, 0), [0.25, 0])
    close(map({ crop }, 1, 1), [0.75, 1])
  })
})

describe('cropRect', () => {
  it('is the whole frame without a crop', () => {
    expect(cropRect(null, 4, 2)).toEqual({ x: 0, y: 0, w: 1, h: 1 })
  })

  it('fits the widest crop of the aspect into the frame', () => {
    const r = cropRect({ aspect: 1, zoom: 1, px: 0, py: 0 }, 4, 2)
    expect(r).toEqual({ x: 0, y: 0, w: 0.5, h: 1 })
    const wide = cropRect({ aspect: 2, zoom: 1, px: 0.5, py: 0.5 }, 3, 3)
    expect(wide.w).toBe(1)
    expect(wide.h).toBeCloseTo(0.5)
    expect(wide.y).toBeCloseTo(0.25)
  })

  it('zooms in and moves within the free space', () => {
    const r = cropRect({ aspect: 0, zoom: 0.5, px: 1, py: 0 }, 4, 2)
    expect(r).toEqual({ x: 0.5, y: 0, w: 0.5, h: 0.5 })
  })
})

describe('straightenScale', () => {
  it('is 1 when level and grows with the angle', () => {
    expect(straightenScale(0, 3, 2)).toBeCloseTo(1)
    expect(straightenScale(10, 3, 2)).toBeGreaterThan(1)
    expect(straightenScale(-10, 3, 2)).toBeCloseTo(straightenScale(10, 3, 2))
  })
})

describe('outputSize', () => {
  it('swaps width and height for quarter turns', () => {
    expect(outputSize({ ...defaultEdits, rotation: 90 }, 400, 200)).toEqual({ width: 200, height: 400 })
  })

  it('scales down to the max edge and never up', () => {
    expect(outputSize(defaultEdits, 4000, 2000, 1000)).toEqual({ width: 1000, height: 500 })
    expect(outputSize(defaultEdits, 400, 200, 1000)).toEqual({ width: 400, height: 200 })
  })

  it('follows the crop', () => {
    const crop = { aspect: 1, zoom: 1, px: 0.5, py: 0.5 }
    expect(outputSize({ ...defaultEdits, crop }, 400, 200)).toEqual({ width: 200, height: 200 })
  })
})
