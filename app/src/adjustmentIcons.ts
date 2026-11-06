import {
  Aperture,
  Circle,
  Contrast,
  Droplets,
  Flame,
  Moon,
  MoveHorizontal,
  MoveVertical,
  Pipette,
  Ruler,
  Scaling,
  Sun,
  Thermometer,
  Triangle,
  type LucideIcon,
} from 'lucide-react'
import type { SliderKey } from './edits'

export type AdjustmentIcon = { icon: LucideIcon; filled?: boolean }

// One small icon per adjustment. Whites and blacks share a circle, empty and filled.
export const SLIDER_ICONS: Record<SliderKey, AdjustmentIcon> = {
  exposure: { icon: Aperture },
  contrast: { icon: Contrast },
  highlights: { icon: Sun },
  shadows: { icon: Moon },
  whites: { icon: Circle },
  blacks: { icon: Circle, filled: true },
  temperature: { icon: Thermometer },
  tint: { icon: Pipette },
  vibrance: { icon: Flame },
  saturation: { icon: Droplets },
  sharpness: { icon: Triangle },
}

export const CROP_ICONS = {
  zoom: { icon: Scaling },
  px: { icon: MoveHorizontal },
  py: { icon: MoveVertical },
  straighten: { icon: Ruler },
} satisfies Record<string, AdjustmentIcon>
