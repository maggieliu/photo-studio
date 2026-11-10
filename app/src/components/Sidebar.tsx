import { CirclePlus, Heart, Images, Plus } from 'lucide-react'
import type { AlbumRecord } from '@/catalog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { CapabilityResult } from '@/capabilities'
import type { PiUser } from '@/pi'
import { DeviceCheck } from './DeviceCheck'
import { PiAccount } from './PiAccount'

export type LibraryView = { kind: 'all' } | { kind: 'favorites' } | { kind: 'album'; id: string }

type Props = {
  view: LibraryView
  albums: AlbumRecord[]
  counts: { all: number; favorites: number; albums: Record<string, number> }
  storage?: string
  capabilities: CapabilityResult[]
  disabled?: boolean
  onSelectView: (view: LibraryView) => void
  onNewAlbum: () => void
  onUpload: () => void
  /** Shows the welcome page. */
  onHome: () => void
  piUser?: PiUser
  piBusy: boolean
  onPiSignIn: () => void
  onPiSignOut: () => void
}

function NavItem({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon?: React.ReactNode
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <li>
      <button
        type="button"
        aria-current={active ? 'page' : undefined}
        onClick={onClick}
        className={cn(
          'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-base font-semibold transition-colors',
          'hover:bg-sidebar-accent/60 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
          active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground',
        )}
      >
        {icon}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className={cn('text-sm tabular-nums', active ? 'text-sidebar-accent-foreground/80' : 'text-muted-foreground')}>
          {count}
        </span>
      </button>
    </li>
  )
}

/** Library navigation: views, albums and upload. Used as a fixed column on desktop and inside a drawer on phones. */
export function Sidebar({ view, albums, counts, storage, capabilities, disabled, onSelectView, onNewAlbum, onUpload, onHome, piUser, piBusy, onPiSignIn, onPiSignOut }: Props) {
  return (
    <nav aria-label="Library" className="flex h-full flex-col gap-4 bg-sidebar p-4 text-sidebar-foreground">
      <button
        type="button"
        onClick={onHome}
        aria-label="Photo Studio, go to the welcome page"
        className="-mx-1 flex min-h-11 items-center gap-2 rounded-lg px-3 text-left transition-colors hover:bg-sidebar-accent/60 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
      >
        <img src={`${import.meta.env.BASE_URL}icon-96.png`} alt="" width={32} height={32} className="size-8 rounded-lg" />
        <span className="text-xl font-black tracking-tight">Photo Studio</span>
      </button>

      <ul className="flex flex-col gap-1">
        <NavItem
          icon={<Images className="size-5" aria-hidden />}
          label="All photos"
          count={counts.all}
          active={view.kind === 'all'}
          onClick={() => onSelectView({ kind: 'all' })}
        />
        <NavItem
          icon={<Heart className="size-5" aria-hidden />}
          label="Favorites"
          count={counts.favorites}
          active={view.kind === 'favorites'}
          onClick={() => onSelectView({ kind: 'favorites' })}
        />
      </ul>

      {/* A tinted band so the heading stands out from the rows around it. */}
      <div className="flex items-center justify-between rounded-lg bg-secondary pl-3">
        <h2 className="text-sm font-bold tracking-wide text-sidebar-foreground uppercase">Albums</h2>
        <Button variant="ghost" size="icon" aria-label="New album" onClick={onNewAlbum} className="size-11">
          <CirclePlus className="size-6 text-sidebar-accent-foreground" />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {albums.length === 0 ? (
          <p className="px-3 text-sm text-muted-foreground">No albums yet. Tap + to make one.</p>
        ) : (
          <ul className="flex flex-col gap-1 pr-2">
            {albums.map((a) => (
              <NavItem
                key={a.id}
                label={a.name}
                count={counts.albums[a.id] ?? 0}
                active={view.kind === 'album' && view.id === a.id}
                onClick={() => onSelectView({ kind: 'album', id: a.id })}
              />
            ))}
          </ul>
        )}
      </ScrollArea>

      <div className="grid gap-3">
        <PiAccount user={piUser} busy={piBusy} onSignIn={onPiSignIn} onSignOut={onPiSignOut} />
        <Button size="lg" className="h-12 w-full text-base font-bold" onClick={onUpload} disabled={disabled}>
          <Plus className="size-5" /> Upload photos
        </Button>
        <div className="flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">{storage ?? ''}</span>
          <DeviceCheck capabilities={capabilities} />
        </div>
        {/* Plain pages that live next to the app, so they work without it loading. */}
        <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noopener" className="flex min-h-11 items-center px-3 underline-offset-2 hover:underline focus-visible:underline">
            Privacy
          </a>
          <span aria-hidden>·</span>
          <a href={`${import.meta.env.BASE_URL}terms.html`} target="_blank" rel="noopener" className="flex min-h-11 items-center px-3 underline-offset-2 hover:underline focus-visible:underline">
            Terms
          </a>
        </p>
      </div>
    </nav>
  )
}
