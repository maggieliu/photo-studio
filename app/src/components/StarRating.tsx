import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  value: number
  onChange: (value: number) => void
  className?: string
}

/** Five tappable stars. Tapping the current rating clears it. */
export function StarRating({ value, onChange, className }: Props) {
  return (
    <div role="radiogroup" aria-label="Rating" className={cn('flex items-center', className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          onClick={() => onChange(value === n ? 0 : n)}
          className="flex size-11 items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Star className={cn('size-7 transition-colors', n <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/60')} />
        </button>
      ))}
    </div>
  )
}
