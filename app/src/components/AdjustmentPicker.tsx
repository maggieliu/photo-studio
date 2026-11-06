import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import type { AdjustmentIcon } from '@/adjustmentIcons'
import { SliderRow } from './SliderRow'

export type AdjustmentItem = AdjustmentIcon & {
  id: string
  label: string
  value: number
  min: number
  max: number
  step?: number
  /** The value that counts as "not changed". */
  resetValue?: number
  format?: (v: number) => string
  /** Greyed out and skipped, for adjustments that do not apply right now. */
  disabled?: boolean
}

type Props = {
  items: AdjustmentItem[]
  active: string
  label?: string
  onActiveChange: (id: string) => void
  onChange: (id: string, value: number) => void
  onReset: (id: string) => void
}

/** A row of small icons to pick an adjustment, and only that adjustment's slider underneath. */
export function AdjustmentPicker({ items, active, label = 'Choose an adjustment', onActiveChange, onChange, onReset }: Props) {
  // If the chosen one is unavailable, fall back to the first one that is.
  const current = items.find((i) => i.id === active && !i.disabled) ?? items.find((i) => !i.disabled) ?? items[0]

  return (
    <div className="grid gap-1">
      <ToggleGroup
        type="single"
        value={current.id}
        onValueChange={(id) => id && onActiveChange(id)}
        aria-label={label}
        spacing={1}
        className="w-full justify-between"
      >
        {items.map((item) => {
          const Icon = item.icon
          const changed = item.value !== (item.resetValue ?? 0)
          return (
            <ToggleGroupItem
              key={item.id}
              value={item.id}
              aria-label={item.label}
              title={item.label}
              disabled={item.disabled}
              className="relative size-11 rounded-lg p-0 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
            >
              <Icon className={cn('size-5', item.filled && 'fill-current')} />
              {/* A dot shows which adjustments have been changed. */}
              {changed && !item.disabled && <span aria-hidden className="absolute top-1.5 right-1.5 size-2 rounded-full bg-ring" />}
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>

      <SliderRow
        key={current.id}
        label={current.label}
        value={current.value}
        min={current.min}
        max={current.max}
        step={current.step}
        resetValue={current.resetValue}
        format={current.format}
        onChange={(v) => onChange(current.id, v)}
        onReset={() => onReset(current.id)}
      />
    </div>
  )
}
