import type { Crop, EditSettings } from './edits'
import { fitWithin } from './imageMeta'

/** Affine transform [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Affine = readonly [number, number, number, number, number, number]

const IDENTITY: Affine = [1, 0, 0, 1, 0, 0]

/** The transform that applies `inner` first, then `outer`. */
export function compose(outer: Affine, inner: Affine): Affine {
  const [a1, b1, c1, d1, e1, f1] = outer
  const [a2, b2, c2, d2, e2, f2] = inner
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ]
}

export function applyAffine(m: Affine, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

export type Rect = { x: number; y: number; w: number; h: number }

/** Size of the image after the quarter-turn rotation, before cropping. */
export function frameSize(rotation: number, srcW: number, srcH: number) {
  return rotation % 180 === 0 ? { w: srcW, h: srcH } : { w: srcH, h: srcW }
}

/** The crop as a normalized rectangle of the frame. */
export function cropRect(crop: Crop | null, frameW: number, frameH: number): Rect {
  if (!crop) return { x: 0, y: 0, w: 1, h: 1 }
  const aspect = crop.aspect > 0 ? crop.aspect : frameW / frameH
  let w: number
  let h: number
  if (aspect >= frameW / frameH) {
    w = 1
    h = frameW / aspect / frameH
  } else {
    h = 1
    w = (aspect * frameH) / frameW
  }
  w *= crop.zoom
  h *= crop.zoom
  return { x: crop.px * (1 - w), y: crop.py * (1 - h), w, h }
}

/** Zoom needed so a straightened image still covers the whole frame. */
export function straightenScale(degrees: number, frameW: number, frameH: number) {
  const t = (Math.abs(degrees) * Math.PI) / 180
  return Math.cos(t) + Math.sin(t) * Math.max(frameW / frameH, frameH / frameW)
}

/**
 * Maps a point of the output image (0–1 in both axes, y down) to the matching
 * point of the source image (also 0–1). Edits apply in the order rotate → flip →
 * straighten → crop, so this walks them backwards.
 */
export function outputToSource(edits: EditSettings, srcW: number, srcH: number): Affine {
  const frame = frameSize(edits.rotation, srcW, srcH)
  const rect = cropRect(edits.crop, frame.w, frame.h)
  const chain: Affine[] = []

  // output → frame pixels
  chain.push([rect.w * frame.w, 0, 0, rect.h * frame.h, rect.x * frame.w, rect.y * frame.h])

  // undo straighten about the frame centre, including the cover zoom
  const phi = (-edits.straighten * Math.PI) / 180
  const s = straightenScale(edits.straighten, frame.w, frame.h)
  const cx = frame.w / 2
  const cy = frame.h / 2
  chain.push([1, 0, 0, 1, -cx, -cy])
  chain.push([1 / s, 0, 0, 1 / s, 0, 0])
  chain.push([Math.cos(phi), Math.sin(phi), -Math.sin(phi), Math.cos(phi), 0, 0])
  chain.push([1, 0, 0, 1, cx, cy])

  if (edits.flipH) chain.push([-1, 0, 0, 1, frame.w, 0])

  // undo each clockwise quarter turn
  let w = frame.w
  let h = frame.h
  for (let i = 0; i < edits.rotation / 90; i++) {
    chain.push([0, -1, 1, 0, 0, w])
    ;[w, h] = [h, w]
  }

  chain.push([1 / srcW, 0, 0, 1 / srcH, 0, 0])
  return chain.reduce((acc, m) => compose(m, acc), IDENTITY)
}

/** Pixel size of the rendered result, scaled down to fit `maxEdge` (never up). */
export function outputSize(edits: EditSettings, srcW: number, srcH: number, maxEdge = Infinity) {
  const frame = frameSize(edits.rotation, srcW, srcH)
  const rect = cropRect(edits.crop, frame.w, frame.h)
  return fitWithin(Math.round(rect.w * frame.w), Math.round(rect.h * frame.h), maxEdge)
}
