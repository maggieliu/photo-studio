import { Aperture, Circle, Contrast, Droplets, Flame, Moon, Pipette, Sun, Thermometer, Triangle, type LucideIcon } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import type { EditSettings, SliderDef, SliderKey } from '@/edits'
import { SliderRow } from './SliderRow'

// One small icon per adjustment. Whites and blacks share a circle, empty and filled.
const ICONS: Record<SliderKey, { icon: LucideIcon; filled?: boolean }> = {
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

type Props = {
  sliders: SliderDef[]
  edits: EditSettings
  active: SliderKey
  onActiveChange: (key: SliderKey) => void
  onChange: (key: SliderKey, value: number) => void
  onReset: (key: SliderKey) => void
}

/** A row of small icons to pick an adjustment, and only that adjustment's slider underneath. */
export function AdjustmentPicker({ sliders, edits, active, onActiveChange, onChange, onReset }: Props) {
  const current = sliders.find((s) => s.key === active) ?? sliders[0]

  return (
    <div className="grid gap-1">
      <ToggleGroup
        type="single"
        value={current.key}
        onValueChange={(key) => key && onActiveChange(key as SliderKey)}
        aria-label="Choose an adjustment"
        spacing={1}
        className="w-full justify-between"
      >
        {sliders.map((def) => {
          const { icon: Icon, filled } = ICONS[def.key]
          return (
            <ToggleGroupItem
              key={def.key}
              value={def.key}
              aria-label={def.label}
              title={def.label}
              className="relative size-11 rounded-lg p-0 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
            >
              <Icon className={cn('size-5', filled && 'fill-current')} />
              {/* A dot shows which adjustments have been changed. */}
              {edits[def.key] !== 0 && <span aria-hidden className="absolute top-1.5 right-1.5 size-2 rounded-full bg-ring" />}
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>

      <SliderRow
        key={current.key}
        label={current.label}
        value={edits[current.key]}
        min={current.min}
        max={current.max}
        onChange={(v) => onChange(current.key, v)}
        onReset={() => onReset(current.key)}
      />
    </div>
  )
}
