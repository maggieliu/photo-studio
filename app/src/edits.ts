export type Crop = {
  /** Width / height of the crop in pixels. 0 keeps the frame's own aspect. */
  aspect: number
  /** 0.1 – 1: how much of the maximum crop to keep. */
  zoom: number
  /** 0 – 1: where the crop sits inside the free space. */
  px: number
  py: number
}

export type EditSettings = {
  exposure: number
  contrast: number
  highlights: number
  shadows: number
  whites: number
  blacks: number
  temperature: number
  tint: number
  vibrance: number
  saturation: number
  sharpness: number
  rotation: 0 | 90 | 180 | 270
  flipH: boolean
  /** Degrees, positive turns the image clockwise. */
  straighten: number
  crop: Crop | null
}

export const defaultEdits: EditSettings = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  temperature: 0,
  tint: 0,
  vibrance: 0,
  saturation: 0,
  sharpness: 0,
  rotation: 0,
  flipH: false,
  straighten: 0,
  crop: null,
}

export type SliderKey =
  | 'exposure'
  | 'contrast'
  | 'highlights'
  | 'shadows'
  | 'whites'
  | 'blacks'
  | 'temperature'
  | 'tint'
  | 'vibrance'
  | 'saturation'
  | 'sharpness'

export type SliderDef = { key: SliderKey; label: string; min: number; max: number; group: 'light' | 'color' | 'detail' }

export const SLIDERS: SliderDef[] = [
  { key: 'exposure', label: 'Exposure', min: -100, max: 100, group: 'light' },
  { key: 'contrast', label: 'Contrast', min: -100, max: 100, group: 'light' },
  { key: 'highlights', label: 'Highlights', min: -100, max: 100, group: 'light' },
  { key: 'shadows', label: 'Shadows', min: -100, max: 100, group: 'light' },
  { key: 'whites', label: 'Whites', min: -100, max: 100, group: 'light' },
  { key: 'blacks', label: 'Blacks', min: -100, max: 100, group: 'light' },
  { key: 'temperature', label: 'Temperature', min: -100, max: 100, group: 'color' },
  { key: 'tint', label: 'Tint', min: -100, max: 100, group: 'color' },
  { key: 'vibrance', label: 'Vibrance', min: -100, max: 100, group: 'color' },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100, group: 'color' },
  { key: 'sharpness', label: 'Sharpness', min: 0, max: 100, group: 'detail' },
]

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

/** Fills in missing fields and clamps values, so stored edits survive future changes. */
export function normalizeEdits(raw?: Partial<EditSettings> | null): EditSettings {
  const out: EditSettings = { ...defaultEdits }
  if (!raw) return out
  for (const s of SLIDERS) out[s.key] = clamp(num(raw[s.key], 0), s.min, s.max)
  out.rotation = ([0, 90, 180, 270] as const).includes(raw.rotation as 0) ? (raw.rotation as EditSettings['rotation']) : 0
  out.flipH = raw.flipH === true
  out.straighten = clamp(num(raw.straighten, 0), -45, 45)
  const c = raw.crop
  out.crop = c
    ? {
        aspect: Math.max(0, num(c.aspect, 0)),
        zoom: clamp(num(c.zoom, 1), 0.1, 1),
        px: clamp(num(c.px, 0.5), 0, 1),
        py: clamp(num(c.py, 0.5), 0, 1),
      }
    : null
  return out
}

export function isDefaultEdits(e: EditSettings): boolean {
  return JSON.stringify(normalizeEdits(e)) === JSON.stringify(defaultEdits)
}

export function rotateBy(edits: EditSettings, quarterTurns: 1 | -1): EditSettings {
  const rotation = ((((edits.rotation / 90 + quarterTurns) % 4) + 4) % 4) * 90
  return { ...edits, rotation: rotation as EditSettings['rotation'] }
}

export const CROP_ASPECTS: { label: string; aspect: number }[] = [
  { label: 'Original', aspect: 0 },
  { label: '1:1', aspect: 1 },
  { label: '4:5', aspect: 4 / 5 },
  { label: '5:4', aspect: 5 / 4 },
  { label: '3:2', aspect: 3 / 2 },
  { label: '2:3', aspect: 2 / 3 },
  { label: '16:9', aspect: 16 / 9 },
  { label: '9:16', aspect: 9 / 16 },
]

export type Preset = { name: string; values: Partial<Pick<EditSettings, SliderKey>> }

export const PRESETS: Preset[] = [
  { name: 'Original', values: {} },
  { name: 'Vivid', values: { vibrance: 40, saturation: 15, contrast: 15 } },
  { name: 'Warm', values: { temperature: 30, vibrance: 20 } },
  { name: 'Cool', values: { temperature: -30, tint: -5 } },
  { name: 'Faded', values: { contrast: -25, blacks: 35, saturation: -20 } },
  { name: 'B&W', values: { saturation: -100, contrast: 20 } },
  { name: 'Punchy B&W', values: { saturation: -100, contrast: 45, blacks: -20, whites: 15 } },
]

/** Presets replace all tone and color sliders but leave crop and rotation alone. */
export function applyPreset(edits: EditSettings, preset: Preset): EditSettings {
  const next = { ...edits }
  for (const s of SLIDERS) next[s.key] = 0
  return { ...next, ...preset.values }
}
