import { useState } from 'react'
import { CheckCheck, FolderMinus, FolderPlus, Heart, Share2, Tag, Trash2 } from 'lucide-react'
import type { AlbumRecord } from '@/catalog'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type Props = {
  count: number
  albums: AlbumRecord[]
  /** The open album, when viewing one, so photos can be taken out of it. */
  activeAlbum?: AlbumRecord
  onSelectAll: () => void
  onFavorite: () => void
  onAddToAlbum: (albumId: string) => void
  onRemoveFromAlbum: () => void
  onTag: (tag: string) => void
  onExport: () => void
  onDelete: () => void
}

function TagPopover({ disabled, onTag }: { disabled: boolean; onTag: (tag: string) => void }) {
  const [tag, setTag] = useState('')
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-10 gap-1.5" disabled={disabled} aria-label="Add tag">
          <Tag /> <span className="hidden sm:inline">Tag</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-72">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!tag.trim()) return
            onTag(tag)
            setTag('')
            setOpen(false)
          }}
        >
          <Input
            autoFocus
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="Tag for selected photos"
            aria-label="Tag for selected photos"
            className="h-10 text-base"
          />
          <Button type="submit" className="h-10" disabled={!tag.trim()}>
            Add
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}

/** Actions for the photos ticked in select mode. */
export function SelectionBar({ count, albums, activeAlbum, ...on }: Props) {
  const none = count === 0
  return (
    // `mt-auto` keeps the bar at the bottom when there are few photos; `sticky` keeps it in view when there are many.
    <div className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 mt-auto flex justify-center pt-4">
    <div
      role="toolbar"
      aria-label="Selection actions"
      className="flex w-fit max-w-full flex-wrap items-center justify-center gap-1.5 rounded-xl border bg-card/95 p-2 shadow-2xl backdrop-blur"
    >
      {/* On phones the count is shown in the page header to keep the buttons on one row. */}
      <span className="hidden px-2 text-sm font-semibold tabular-nums sm:inline">{count} selected</span>
      <Button variant="ghost" size="sm" className="h-10 gap-1.5" onClick={on.onSelectAll} aria-label="Select all">
        <CheckCheck /> <span className="hidden sm:inline">All</span>
      </Button>
      <Button variant="outline" size="sm" className="h-10 gap-1.5" disabled={none} onClick={on.onFavorite} aria-label="Favorite">
        <Heart /> <span className="hidden sm:inline">Favorite</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-10 gap-1.5" disabled={none} aria-label="Add to album">
            <FolderPlus /> <span className="hidden sm:inline">Album</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          <DropdownMenuLabel>Add to album</DropdownMenuLabel>
          {albums.length === 0 && <DropdownMenuItem disabled>No albums yet</DropdownMenuItem>}
          {albums.map((a) => (
            <DropdownMenuItem key={a.id} onSelect={() => on.onAddToAlbum(a.id)}>
              {a.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <TagPopover disabled={none} onTag={on.onTag} />

      {activeAlbum && (
        <Button
          variant="outline"
          size="sm"
          className="h-10 gap-1.5"
          disabled={none}
          onClick={on.onRemoveFromAlbum}
          aria-label={`Remove from ${activeAlbum.name}`}
        >
          <FolderMinus /> <span className="hidden sm:inline">Remove</span>
        </Button>
      )}

      <Button size="sm" className="h-10 gap-1.5" disabled={none} onClick={on.onExport} aria-label="Export">
        <Share2 /> <span className="hidden sm:inline">Export</span>
      </Button>
      <Button variant="destructive" size="sm" className="h-10 gap-1.5" disabled={none} onClick={on.onDelete} aria-label="Delete">
        <Trash2 /> <span className="hidden sm:inline">Delete</span>
      </Button>
    </div>
    </div>
  )
}
