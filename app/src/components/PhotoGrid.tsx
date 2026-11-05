import { Check, Heart, ImagePlus, Pencil, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { LibraryPhoto } from '@/useLibrary'

const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3 md:grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] md:gap-4'

type Props = {
  photos: LibraryPhoto[]
  selecting: boolean
  checked: Set<string>
  onOpen: (id: string) => void
  onToggle: (id: string) => void
}

export function PhotoGrid({ photos, selecting, checked, onOpen, onToggle }: Props) {
  return (
    <ul className={GRID}>
      {photos.map((p) => {
        const isChecked = checked.has(p.id)
        return (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => (selecting ? onToggle(p.id) : onOpen(p.id))}
              aria-label={`${selecting ? 'Select' : 'Open'} ${p.name}`}
              aria-pressed={selecting ? isChecked : undefined}
              className={cn(
                'group relative block aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted outline-none',
                'focus-visible:ring-[3px] focus-visible:ring-ring',
                isChecked && 'ring-[3px] ring-ring',
              )}
            >
              <img
                src={p.thumbUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className={cn(
                  'size-full object-cover transition duration-200 group-hover:scale-[1.03]',
                  isChecked && 'scale-[0.97] rounded-md',
                )}
              />
              {(p.favorite || p.rating > 0 || p.edits) && (
                <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1.5 rounded-full bg-black/65 px-2 py-0.5 text-xs font-semibold text-white">
                  {p.favorite && <Heart className="size-3.5 fill-current" aria-label="Favorite" />}
                  {p.rating > 0 && (
                    <span className="flex items-center gap-0.5" aria-label={`${p.rating} stars`}>
                      <Star className="size-3.5 fill-current" aria-hidden />
                      {p.rating}
                    </span>
                  )}
                  {p.edits && <Pencil className="size-3.5" aria-label="Edited" />}
                </span>
              )}
              {selecting && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-2 right-2 flex size-6 items-center justify-center rounded-full border-2 border-white',
                    isChecked ? 'bg-primary' : 'bg-black/40',
                  )}
                >
                  {isChecked && <Check className="size-4 text-white" />}
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Placeholder tiles shown while the catalog opens. */
export function GridSkeleton() {
  return (
    <div className={GRID} aria-hidden>
      {Array.from({ length: 12 }, (_, i) => (
        <Skeleton key={i} className="aspect-[4/3] w-full rounded-lg" />
      ))}
    </div>
  )
}

export function EmptyLibrary({ onUpload, disabled }: { onUpload: () => void; disabled: boolean }) {
  return (
    <div className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <ImagePlus className="size-8" aria-hidden />
      </div>
      <h2 className="text-xl font-bold">No photos yet</h2>
      <p className="text-muted-foreground">Upload photos from your device, or drop them anywhere on this page.</p>
      <Button size="lg" className="h-12 px-6 text-base font-bold" onClick={onUpload} disabled={disabled}>
        Upload photos
      </Button>
    </div>
  )
}

export function NoMatches() {
  return (
    <p className="py-16 text-center text-muted-foreground" role="status">
      No photos match. Try clearing the filters.
    </p>
  )
}
