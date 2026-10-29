type Props = {
  value: number
  onChange: (value: number) => void
}

export function StarRating({ value, onChange }: Props) {
  return (
    <div className="stars" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          className={n <= value ? 'on' : ''}
          // Tapping the current rating clears it.
          onClick={() => onChange(value === n ? 0 : n)}
        >
          ★
        </button>
      ))}
    </div>
  )
}
