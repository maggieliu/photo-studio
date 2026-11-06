import { describe, expect, it } from 'vitest'
import type { Crop } from './edits'
import { cropRect } from './geometry'
import { lineAngle, panCrop, sameCrop, straightenAfterTwist, twistDegrees, zoomCrop } from './cropGestures'

// A 4:2 frame with a square crop at half size leaves room to move in both directions.
const crop: Crop = { aspect: 1, zoom: 0.5, px: 0.5, py: 0.5 }
const W = 4000
const H = 2000

describe('panCrop', () => {
  it('moves the window against the finger: dragging right shows more of the left', () => {
    const before = cropRect(crop, W, H)
    const after = cropRect(panCrop(crop, W, H, 400, 400, 100, 0), W, H)
    expect(after.x).toBeLessThan(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })

  it('dragging down shows more of the top', () => {
    const before = cropRect(crop, W, H)
    const after = cropRect(panCrop(crop, W, H, 400, 400, 0, 80), W, H)
    expect(after.y).toBeLessThan(before.y)
  })

  it('moves by the distance dragged: a full-width drag crosses the whole crop width', () => {
    const before = cropRect(crop, W, H)
    const after = cropRect(panCrop(crop, W, H, 400, 400, -400, 0), W, H)
    expect(after.x - before.x).toBeCloseTo(before.w)
  })

  it('stops at the edges of the photo', () => {
    const far = cropRect(panCrop(crop, W, H, 400, 400, 99999, 99999), W, H)
    expect(far.x).toBeCloseTo(0)
    expect(far.y).toBeCloseTo(0)
    const other = cropRect(panCrop(crop, W, H, 400, 400, -99999, -99999), W, H)
    expect(other.x + other.w).toBeCloseTo(1)
    expect(other.y + other.h).toBeCloseTo(1)
  })

  it('keeps the position on an axis that has no room to move', () => {
    // At full size the square crop already spans the frame's full height.
    const full: Crop = { aspect: 1, zoom: 1, px: 0.5, py: 0.25 }
    const moved = panCrop(full, W, H, 400, 400, 0, 120)
    expect(moved.py).toBe(0.25)
  })

  it('starts from the whole photo when there is no crop yet', () => {
    const moved = panCrop(null, W, H, 400, 200, 50, 50)
    expect(moved).toMatchObject({ aspect: 0, zoom: 1 })
  })
})

describe('zoomCrop', () => {
  it('shows less of the photo when the fingers move apart', () => {
    const before = cropRect(crop, W, H)
    const after = cropRect(zoomCrop(crop, W, H, 2), W, H)
    expect(after.w).toBeCloseTo(before.w / 2)
    expect(after.h).toBeCloseTo(before.h / 2)
  })

  it('shows more when the fingers move together', () => {
    const before = cropRect(crop, W, H)
    const after = cropRect(zoomCrop(crop, W, H, 0.5), W, H)
    expect(after.w).toBeGreaterThan(before.w)
  })

  it('zooms around the centre of the window', () => {
    const before = cropRect(crop, W, H)
    const after = cropRect(zoomCrop(crop, W, H, 1.5), W, H)
    expect(after.x + after.w / 2).toBeCloseTo(before.x + before.w / 2)
    expect(after.y + after.h / 2).toBeCloseTo(before.y + before.h / 2)
  })

  it('never goes past the whole photo or below a tenth of it', () => {
    expect(zoomCrop(crop, W, H, 0.0001).zoom).toBe(1)
    expect(zoomCrop(crop, W, H, 10000).zoom).toBeCloseTo(0.1)
  })

  it('starts a crop when pinching in on an uncropped photo', () => {
    const made = zoomCrop(null, W, H, 2)
    expect(made.zoom).toBeCloseTo(0.5)
    expect(made.aspect).toBe(0)
  })

  it('keeps the window inside the photo when zooming out near an edge', () => {
    const corner: Crop = { aspect: 1, zoom: 0.5, px: 1, py: 1 }
    const after = cropRect(zoomCrop(corner, W, H, 0.7), W, H)
    expect(after.x).toBeGreaterThanOrEqual(0)
    expect(after.x + after.w).toBeLessThanOrEqual(1 + 1e-9)
    expect(after.y + after.h).toBeLessThanOrEqual(1 + 1e-9)
  })
})

describe('sameCrop', () => {
  it('treats no crop and a full-size crop as the same view', () => {
    expect(sameCrop(null, { aspect: 0, zoom: 1, px: 0.5, py: 0.5 })).toBe(true)
  })

  it('detects a change in position, size or shape', () => {
    expect(sameCrop(crop, { ...crop, px: 0.6 })).toBe(false)
    expect(sameCrop(crop, { ...crop, zoom: 0.4 })).toBe(false)
    expect(sameCrop(crop, { ...crop, aspect: 2 })).toBe(false)
    expect(sameCrop(crop, { ...crop })).toBe(true)
  })
})

describe('twist', () => {
  it('measures the angle of the line between two fingers', () => {
    expect(lineAngle({ x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(0)
    expect(lineAngle({ x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(90) // down on screen
    expect(lineAngle({ x: 0, y: 0 }, { x: -10, y: 0 })).toBeCloseTo(180)
  })

  it('counts a clockwise turn as positive and anticlockwise as negative', () => {
    expect(twistDegrees(0, 20)).toBeCloseTo(18) // 20 degrees minus the 2 degree dead zone
    expect(twistDegrees(0, -20)).toBeCloseTo(-18)
  })

  it('ignores small movements so a pinch does not tilt the photo', () => {
    expect(twistDegrees(10, 11.5)).toBe(0)
    expect(twistDegrees(10, 8.5)).toBe(0)
  })

  it('takes the short way round the half-turn boundary', () => {
    // Going from 170 to -170 degrees is a 20 degree clockwise turn, not -340.
    expect(twistDegrees(170, -170)).toBeCloseTo(18)
    expect(twistDegrees(-170, 170)).toBeCloseTo(-18)
  })

  it('adds to the current straighten angle within the allowed range', () => {
    expect(straightenAfterTwist(5, 10)).toBe(15)
    expect(straightenAfterTwist(-5, -10)).toBe(-15)
    expect(straightenAfterTwist(40, 30)).toBe(45)
    expect(straightenAfterTwist(-40, -30)).toBe(-45)
    expect(straightenAfterTwist(0, 3.14159)).toBe(3.1)
  })
})
