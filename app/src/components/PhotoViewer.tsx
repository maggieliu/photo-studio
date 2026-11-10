import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Heart, Info, Loader2, Pencil, Share2, Trash2, X } from 'lucide-react'
import type { AlbumRecord, PhotoRecord } from '@/catalog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { swipeDirection } from '@/swipe'
import { usePreview } from '@/usePreview'
import type { LibraryPhoto } from '@/useLibrary'
import { cn } from '@/lib/utils'
import { InfoSheet } from './InfoSheet'
import { StarRating } from './StarRating'

type Props = {
  photo: LibraryPhoto
  /** Place in the list being browsed, shown as "3 of 12". */
  position: { index: number; total: number }
  albums: AlbumRecord[]
  knownTags: string[]
  getOriginal: (id: string) => Promise<Blob | undefined>
  savePreview: (id: string, editsJson: string, preview: Blob) => Promise<void>
  onPrev?: () => void
  onNext?: () => void
  onClose: () => void
  onChange: (change: (photo: PhotoRecord) => PhotoRecord) => void
  onCreateAlbum: (name: string) => Promise<AlbumRecord | undefined>
  onEdit: () => void
  onExport: () => void
  onDelete: () => void
  onRevert: () => void
}

/** Full-screen photo view: a large picture, swipe or arrow keys to move between photos, and quick actions. */
export function PhotoViewer(props: Props) {
  const { photo, position, onPrev, onNext } = props
  const [infoOpen, setInfoOpen] = useState(false)
  const { url, failed, reason } = usePreview(photo, { getOriginal: props.getOriginal, savePreview: props.savePreview })
  const swipeStart = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
      if (e.key === 'ArrowLeft') onPrev?.()
      else if (e.key === 'ArrowRight') onNext?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onPrev, onNext])

  return (
    <Dialog open onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent
        showCloseButton={false}
        className="top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-background p-0 ring-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">{photo.name}</DialogTitle>
        <DialogDescription className="sr-only">Photo viewer. Use the arrow keys or swipe to move between photos.</DialogDescription>

        <header className="flex items-center gap-2 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-1">
          <Button variant="ghost" size="icon" className="size-11" aria-label="Close" onClick={props.onClose}>
            <X className="size-6" />
          </Button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-semibold">{photo.name}</p>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {position.index + 1} of {position.total}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="size-11" aria-label="Photo info" onClick={() => setInfoOpen(true)}>
            <Info className="size-6" />
          </Button>
        </header>

        <div
          className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center overflow-hidden px-2"
          onPointerDown={(e) => {
            swipeStart.current = { x: e.clientX, y: e.clientY }
          }}
          onPointerUp={(e) => {
            const start = swipeStart.current
            swipeStart.current = null
            if (!start) return
            const direction = swipeDirection(e.clientX - start.x, e.clientY - start.y)
            if (direction === 'left') onNext?.()
            else if (direction === 'right') onPrev?.()
          }}
          onPointerCancel={() => (swipeStart.current = null)}
        >
          <img
            // A new key restarts the fade when moving to another photo.
            key={photo.id}
            src={url ?? photo.thumbUrl}
            alt={photo.name}
            draggable={false}
            className={cn(
              'max-h-full max-w-full rounded-md object-contain select-none',
              !url && 'blur-sm',
            )}
          />
          {!url && !failed && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center" role="status">
              <Loader2 className="size-8 animate-spin text-white drop-shadow" aria-label="Loading photo" />
            </div>
          )}
          {failed && (
            <div role="alert" className="absolute bottom-3 max-w-[90%] rounded-md bg-background/90 px-3 py-1.5 text-center">
              <p className="text-sm text-destructive">Could not load the full photo.</p>
              {reason && <p className="mt-0.5 text-xs break-words text-muted-foreground">{reason}</p>}
            </div>
          )}

          {onPrev && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute left-3 size-11 rounded-full bg-black/45 text-white hover:bg-black/60"
              aria-label="Previous photo"
              onClick={onPrev}
            >
              <ChevronLeft className="size-6" />
            </Button>
          )}
          {onNext && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-3 size-11 rounded-full bg-black/45 text-white hover:bg-black/60"
              aria-label="Next photo"
              onClick={onNext}
            >
              <ChevronRight className="size-6" />
            </Button>
          )}
        </div>

        <footer className="grid gap-1 px-3 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between">
            <StarRating value={photo.rating} onChange={(rating) => props.onChange((p) => ({ ...p, rating }))} />
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label="Favorite"
              aria-pressed={photo.favorite}
              onClick={() => props.onChange((p) => ({ ...p, favorite: !p.favorite }))}
            >
              <Heart className={cn('size-7', photo.favorite && 'fill-red-500 text-red-500')} />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button className="h-12 gap-2 text-base font-bold" onClick={props.onEdit}>
              <Pencil /> Edit
            </Button>
            <Button variant="outline" className="h-12 gap-2 text-base" onClick={props.onExport}>
              <Share2 /> Export
            </Button>
            <Button variant="outline" className="h-12 gap-2 text-base text-destructive" onClick={props.onDelete}>
              <Trash2 /> Delete
            </Button>
          </div>
        </footer>

        <InfoSheet
          open={infoOpen}
          photo={photo}
          albums={props.albums}
          knownTags={props.knownTags}
          onOpenChange={setInfoOpen}
          onChange={props.onChange}
          onCreateAlbum={props.onCreateAlbum}
          onRevert={() => {
            setInfoOpen(false)
            props.onRevert()
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
