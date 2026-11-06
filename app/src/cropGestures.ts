import type { Crop } from './edits'
import { cropRect } from './geometry'

const MIN_ZOOM = 0.1
const NEUTRAL: Crop = { aspect: 0, zoom: 1, px: 0.5, py: 0.5 }

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** Position (0–1) of a window of `size` that starts at `start`, within a frame of length 1. */
const toPosition = (start: number, size: number, fallback: number) => (1 - size > 1e-9 ? clamp(start / (1 - size), 0, 1) : fallback)

/**
 * Drags the photo by (dx, dy) screen pixels while it is shown at cssW × cssH.
 * The photo follows the finger, so the crop window moves the opposite way.
 */
export function panCrop(crop: Crop | null, frameW: number, frameH: number, cssW: number, cssH: number, dx: number, dy: number): Crop {
  const base = crop ?? NEUTRAL
  const r = cropRect(base, frameW, frameH)
  const x = clamp(r.x - (dx * r.w) / cssW, 0, 1 - r.w)
  const y = clamp(r.y - (dy * r.h) / cssH, 0, 1 - r.h)
  return { ...base, px: toPosition(x, r.w, base.px), py: toPosition(y, r.h, base.py) }
}

/**
 * Resizes the crop window around its centre. A scale above 1 (fingers moving
 * apart) shows less of the photo; below 1 shows more. It never goes past the
 * whole photo or below a tenth of it.
 */
export function zoomCrop(crop: Crop | null, frameW: number, frameH: number, scale: number): Crop {
  const base = crop ?? NEUTRAL
  const r = cropRect(base, frameW, frameH)
  const zoom = clamp(base.zoom / scale, MIN_ZOOM, 1)
  const k = zoom / base.zoom
  const w = r.w * k
  const h = r.h * k
  const x = clamp(r.x + r.w / 2 - w / 2, 0, 1 - w)
  const y = clamp(r.y + r.h / 2 - h / 2, 0, 1 - h)
  return { ...base, zoom, px: toPosition(x, w, base.px), py: toPosition(y, h, base.py) }
}

/** True when two crops would show the same part of the photo. */
export function sameCrop(a: Crop | null, b: Crop | null): boolean {
  const eps = 1e-6
  const x = a ?? NEUTRAL
  const y = b ?? NEUTRAL
  return x.aspect === y.aspect && Math.abs(x.zoom - y.zoom) < eps && Math.abs(x.px - y.px) < eps && Math.abs(x.py - y.py) < eps
}

type Point = { x: number; y: number }

/** Angle in degrees of the line from a to b. Screen y points down, so a clockwise turn is positive. */
export function lineAngle(a: Point, b: Point): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
}

/**
 * How far a two-finger line has turned since the gesture began, in degrees
 * (clockwise positive, the short way round). The first few degrees are ignored
 * so an ordinary pinch does not tilt the photo by accident.
 */
export function twistDegrees(startAngle: number, angle: number, deadzone = 2): number {
  const turned = ((((angle - startAngle + 180) % 360) + 360) % 360) - 180
  const beyond = Math.max(0, Math.abs(turned) - deadzone)
  // Return a plain 0 inside the dead zone, not -0.
  return beyond === 0 ? 0 : Math.sign(turned) * beyond
}

/** The straighten angle after a twist: limited to ±45° and rounded to a tenth of a degree. */
export function straightenAfterTwist(straighten: number, twist: number): number {
  return Math.round(clamp(straighten + twist, -45, 45) * 10) / 10
}
