import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

type Props = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  /** The value the reset button restores; the button only shows when it differs. */
  resetValue?: number
  format?: (v: number) => string
  onChange: (v: number) => void
  onReset: () => void
}

/** A labeled slider with its current value and a reset button. */
export function SliderRow({ label, value, min, max, step = 1, resetValue = 0, format, onChange, onReset }: Props) {
  return (
    <div className="grid gap-0.5 py-1">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-sm font-medium">{label}</span>
        <output className="min-w-10 text-right text-sm tabular-nums text-muted-foreground">{format ? format(value) : value}</output>
        <Button
          variant="ghost"
          size="icon"
          className={cn('size-8', value === resetValue && 'invisible')}
          aria-label={`Reset ${label}`}
          onClick={onReset}
          // Stays in the layout when hidden, so the row does not jump.
          tabIndex={value === resetValue ? -1 : 0}
        >
          <RotateCcw className="size-4" />
        </Button>
      </div>
      <Slider aria-label={label} min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} />
    </div>
  )
}
