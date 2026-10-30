import { describe, expect, it } from 'vitest'
import { applyPreset, defaultEdits, isDefaultEdits, normalizeEdits, PRESETS, rotateBy, SLIDERS } from './edits'

describe('normalizeEdits', () => {
  it('returns defaults for missing input', () => {
    expect(normalizeEdits()).toEqual(defaultEdits)
    expect(normalizeEdits(null)).toEqual(defaultEdits)
  })

  it('keeps valid values and fills in the rest', () => {
    expect(normalizeEdits({ exposure: 30, rotation: 90 })).toEqual({ ...defaultEdits, exposure: 30, rotation: 90 })
  })

  it('clamps out-of-range and rejects bad values', () => {
    const e = normalizeEdits({
      contrast: 500,
      sharpness: -5,
      straighten: 99,
      rotation: 45 as never,
      tint: NaN,
      crop: { aspect: -1, zoom: 9, px: -2, py: 3 },
    })
    expect(e.contrast).toBe(100)
    expect(e.sharpness).toBe(0)
    expect(e.straighten).toBe(45)
    expect(e.rotation).toBe(0)
    expect(e.tint).toBe(0)
    expect(e.crop).toEqual({ aspect: 0, zoom: 1, px: 0, py: 1 })
  })
})

describe('isDefaultEdits', () => {
  it('detects untouched and touched edits', () => {
    expect(isDefaultEdits(defaultEdits)).toBe(true)
    expect(isDefaultEdits({ ...defaultEdits, flipH: true })).toBe(false)
    expect(isDefaultEdits({ ...defaultEdits, crop: { aspect: 1, zoom: 1, px: 0.5, py: 0.5 } })).toBe(false)
  })
})

describe('rotateBy', () => {
  it('wraps around in both directions', () => {
    expect(rotateBy(defaultEdits, 1).rotation).toBe(90)
    expect(rotateBy(defaultEdits, -1).rotation).toBe(270)
    expect(rotateBy({ ...defaultEdits, rotation: 270 }, 1).rotation).toBe(0)
  })
})

describe('presets', () => {
  it('only use values inside the slider ranges', () => {
    for (const p of PRESETS) {
      for (const [key, value] of Object.entries(p.values)) {
        const def = SLIDERS.find((s) => s.key === key)!
        expect(value).toBeGreaterThanOrEqual(def.min)
        expect(value).toBeLessThanOrEqual(def.max)
      }
    }
  })

  it('replace sliders but keep geometry', () => {
    const base = { ...defaultEdits, exposure: 50, rotation: 90 as const, flipH: true }
    const out = applyPreset(base, PRESETS.find((p) => p.name === 'Warm')!)
    expect(out.exposure).toBe(0)
    expect(out.temperature).toBe(30)
    expect(out.rotation).toBe(90)
    expect(out.flipH).toBe(true)
  })

  it('the Original preset clears all sliders', () => {
    const out = applyPreset({ ...defaultEdits, saturation: 40 }, PRESETS[0])
    expect(isDefaultEdits(out)).toBe(true)
  })
})
