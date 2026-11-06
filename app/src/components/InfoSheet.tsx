import { useState } from 'react'
import { RotateCcw, X } from 'lucide-react'
import type { AlbumRecord, PhotoRecord } from '@/catalog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { addTag } from '@/filter'
import { formatBytes } from '@/imageMeta'
import { useMediaQuery } from '@/useMediaQuery'
import type { LibraryPhoto } from '@/useLibrary'

type Props = {
  open: boolean
  photo: LibraryPhoto
  albums: AlbumRecord[]
  knownTags: string[]
  onOpenChange: (open: boolean) => void
  onChange: (change: (photo: PhotoRecord) => PhotoRecord) => void
  onCreateAlbum: (name: string) => Promise<AlbumRecord | undefined>
  onRevert: () => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-bold">{title}</h3>
      {children}
    </section>
  )
}

/** Tags, albums and file details for the photo being viewed. A side panel on large screens, a bottom sheet on phones. */
export function InfoSheet({ open, photo, albums, knownTags, onOpenChange, onChange, onCreateAlbum, onRevert }: Props) {
  const wide = useMediaQuery('(min-width: 768px)')
  const [tagInput, setTagInput] = useState('')
  const [albumInput, setAlbumInput] = useState('')

  const submitTag = () => {
    onChange((p) => ({ ...p, tags: addTag(p.tags, tagInput) }))
    setTagInput('')
  }

  const toggleAlbum = (id: string, member: boolean) =>
    onChange((p) => ({ ...p, albumIds: member ? p.albumIds.filter((a) => a !== id) : [...p.albumIds, id] }))

  const submitAlbum = async () => {
    const album = await onCreateAlbum(albumInput)
    setAlbumInput('')
    if (album) onChange((p) => ({ ...p, albumIds: [...p.albumIds, album.id] }))
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={wide ? 'right' : 'bottom'} className="max-h-[85dvh] gap-0 overflow-y-auto data-[side=right]:max-h-none data-[side=bottom]:rounded-t-2xl">
        <SheetHeader className="pr-14">
          <SheetTitle className="text-lg font-bold break-all">{photo.name}</SheetTitle>
          <SheetDescription>Tags, albums and details</SheetDescription>
        </SheetHeader>

        <div className="grid gap-6 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <Section title="Tags">
            {photo.tags.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {photo.tags.map((t) => (
                  <li key={t}>
                    <Badge variant="secondary" className="h-8 gap-1 pr-1 pl-3 text-sm">
                      {t}
                      <button
                        type="button"
                        aria-label={`Remove tag ${t}`}
                        className="flex size-6 items-center justify-center rounded-full hover:bg-foreground/10"
                        onClick={() => onChange((p) => ({ ...p, tags: p.tags.filter((x) => x !== t) }))}
                      >
                        <X className="size-3.5" />
                      </button>
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                submitTag()
              }}
            >
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add a tag"
                list="known-tags"
                aria-label="Add a tag"
                className="h-11 text-base"
              />
              <datalist id="known-tags">
                {knownTags
                  .filter((t) => !photo.tags.includes(t))
                  .map((t) => (
                    <option key={t} value={t} />
                  ))}
              </datalist>
              <Button type="submit" className="h-11 px-4" disabled={!tagInput.trim()}>
                Add
              </Button>
            </form>
          </Section>

          <Section title="Albums">
            {albums.length > 0 && (
              <ul className="grid">
                {albums.map((a) => {
                  const member = photo.albumIds.includes(a.id)
                  return (
                    <li key={a.id}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base">
                        <Checkbox checked={member} onCheckedChange={() => toggleAlbum(a.id, member)} className="size-5" />
                        {a.name}
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                submitAlbum()
              }}
            >
              <Input
                value={albumInput}
                onChange={(e) => setAlbumInput(e.target.value)}
                placeholder="New album"
                aria-label="New album name"
                className="h-11 text-base"
              />
              <Button type="submit" variant="outline" className="h-11 px-4" disabled={!albumInput.trim()}>
                Create
              </Button>
            </form>
          </Section>

          <Section title="Details">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Size</dt>
              <dd>
                {formatBytes(photo.size)}
                {photo.width && photo.height ? ` · ${photo.width}×${photo.height}` : ''}
              </dd>
              {photo.takenAt && (
                <>
                  <dt className="text-muted-foreground">Taken</dt>
                  <dd>{new Date(photo.takenAt).toLocaleString()}</dd>
                </>
              )}
              {(photo.make || photo.model) && (
                <>
                  <dt className="text-muted-foreground">Camera</dt>
                  <dd>{[photo.make, photo.model].filter(Boolean).join(' ')}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Edits</dt>
              <dd>{photo.edits ? 'This photo has been edited' : 'None'}</dd>
            </dl>
            {photo.edits && (
              <Button variant="outline" className="mt-1 h-11 w-full gap-2" onClick={onRevert}>
                <RotateCcw /> Revert to original
              </Button>
            )}
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
