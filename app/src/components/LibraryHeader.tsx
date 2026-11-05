import { MoreHorizontal, Menu, Pencil, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Toggle } from '@/components/ui/toggle'
import { emptyFilter, type Filter } from '@/filter'

type Props = {
  title: string
  subtitle: string
  filter: Filter
  tags: { tag: string; count: number }[]
  selecting: boolean
  canSelect: boolean
  uploadDisabled: boolean
  /** Set when an album is open, to offer rename and delete. */
  onRenameAlbum?: () => void
  onDeleteAlbum?: () => void
  onFilterChange: (patch: Partial<Filter>) => void
  onToggleSelect: () => void
  onOpenMenu: () => void
  onUpload: () => void
}

/** Number of filters that are narrowing the grid (sorting and the album view do not count). */
function activeFilterCount(f: Filter) {
  return (f.minRating > 0 ? 1 : 0) + f.tags.length
}

function FilterPanel({ filter, tags, onFilterChange }: Pick<Props, 'filter' | 'tags' | 'onFilterChange'>) {
  const count = activeFilterCount(filter)
  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <span className="text-sm font-semibold">Minimum rating</span>
        <Select value={String(filter.minRating)} onValueChange={(v) => onFilterChange({ minRating: Number(v) })}>
          <SelectTrigger className="w-full" aria-label="Minimum rating">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Any rating</SelectItem>
            {[1, 2, 3, 4, 5].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} star{n === 1 ? '' : 's'} and up
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <span className="text-sm font-semibold">Sort by</span>
        <Select value={filter.sort} onValueChange={(v) => onFilterChange({ sort: v as Filter['sort'] })}>
          <SelectTrigger className="w-full" aria-label="Sort by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="added">Date added</SelectItem>
            <SelectItem value="taken">Date taken</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {tags.length > 0 && (
        <div className="grid gap-1.5">
          <span className="text-sm font-semibold">Tags</span>
          <ul className="flex flex-wrap gap-1.5" aria-label="Filter by tag">
            {tags.slice(0, 20).map(({ tag, count }) => (
              <li key={tag}>
                <Toggle
                  variant="outline"
                  size="sm"
                  pressed={filter.tags.includes(tag)}
                  onPressedChange={(on) =>
                    onFilterChange({ tags: on ? [...filter.tags, tag] : filter.tags.filter((t) => t !== tag) })
                  }
                  className="rounded-full"
                >
                  {tag} · {count}
                </Toggle>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        disabled={count === 0}
        onClick={() => onFilterChange({ minRating: emptyFilter.minRating, tags: [] })}
      >
        Clear filters
      </Button>
    </div>
  )
}

export function LibraryHeader(props: Props) {
  const { title, subtitle, filter, selecting, canSelect, uploadDisabled, onFilterChange } = props
  const count = activeFilterCount(filter)

  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="flex items-center gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 md:px-8 md:pt-5">
        <Button variant="ghost" size="icon" className="-ml-2 size-11 md:hidden" aria-label="Open menu" onClick={props.onOpenMenu}>
          <Menu className="size-6" />
        </Button>

        <div className="min-w-0 flex-1">
          <h1 className="line-clamp-2 text-2xl leading-tight font-black tracking-tight break-words md:line-clamp-1 md:text-3xl">{title}</h1>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {subtitle}
          </p>
        </div>

        {props.onRenameAlbum && props.onDeleteAlbum && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-11" aria-label="Album options">
                <MoreHorizontal className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={props.onRenameAlbum}>
                <Pencil /> Rename album
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={props.onDeleteAlbum}>
                <Trash2 /> Delete album
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Button
          variant={selecting ? 'default' : 'outline'}
          className="h-11 px-4 text-base"
          aria-pressed={selecting}
          disabled={!canSelect && !selecting}
          onClick={props.onToggleSelect}
        >
          {selecting ? 'Done' : 'Select'}
        </Button>
        <Button size="icon" className="size-11 md:hidden" aria-label="Import photos" disabled={uploadDisabled} onClick={props.onUpload}>
          <Plus className="size-5" />
        </Button>
      </div>

      {canSelect && (
        <div className="flex gap-2 px-4 pb-3 md:px-8">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={filter.query}
              onChange={(e) => onFilterChange({ query: e.target.value })}
              placeholder="Search name, camera or tag"
              aria-label="Search"
              // 16px stops iOS from zooming in when the field gets focus.
              className="h-11 pl-9 text-base"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-11 gap-2 px-3 text-base" aria-label="Filters and sorting">
                <SlidersHorizontal className="size-4" />
                <span className="hidden sm:inline">Filters</span>
                {count > 0 && <Badge className="h-5 min-w-5 rounded-full px-1.5">{count}</Badge>}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))]">
              <FilterPanel filter={filter} tags={props.tags} onFilterChange={onFilterChange} />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </header>
  )
}
