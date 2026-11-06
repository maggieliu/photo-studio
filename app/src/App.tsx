import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { detectInBrowser } from './capabilities'
import { ConfirmDialog, NameDialog } from './components/dialogs'
import { Landing } from './components/Landing'
import { LibraryHeader } from './components/LibraryHeader'
import { PhotoViewer } from './components/PhotoViewer'
import { EmptyLibrary, GridSkeleton, NoMatches, PhotoGrid } from './components/PhotoGrid'
import { SelectionBar } from './components/SelectionBar'
import { Sidebar, type LibraryView } from './components/Sidebar'
import { Progress } from './components/ui/progress'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from './components/ui/sheet'
import { Toaster } from './components/ui/sonner'
import { TooltipProvider } from './components/ui/tooltip'
import { defaultEdits } from './edits'
import type { ExportItem } from './exportPhoto'
import { addTag, emptyFilter, filterPhotos, tagCounts, type Filter } from './filter'
import { formatBytes } from './imageMeta'
import { markLandingSeen, readLandingSeen } from './landingState'
import { makeOriginalThumb } from './preview'
import { useLibrary } from './useLibrary'
import { usePiAccount } from './usePiAccount'

// The editor and export dialog are big and only needed on demand, so they load when first opened.
const Editor = lazy(() => import('./Editor').then((m) => ({ default: m.Editor })))
const ExportDialog = lazy(() => import('./ExportDialog').then((m) => ({ default: m.ExportDialog })))

function App() {
  const lib = useLibrary()
  const pi = usePiAccount()
  const { photos, albums, ready, error, progress, importErrors } = lib
  const [view, setView] = useState<LibraryView>({ kind: 'all' })
  const [filter, setFilter] = useState<Filter>(emptyFilter)
  const [menuOpen, setMenuOpen] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [viewerId, setViewerId] = useState<string>()
  const [editingId, setEditingId] = useState<string>()
  const [exportItems, setExportItems] = useState<ExportItem[]>()
  const [albumDialog, setAlbumDialog] = useState<'create' | 'rename'>()
  const [confirm, setConfirm] = useState<'album' | 'photos' | 'photo' | 'revert'>()
  const [storage, setStorage] = useState<string>()
  const [landingSeen, setLandingSeen] = useState(readLandingSeen)
  const [landingRequested, setLandingRequested] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const capabilities = useMemo(() => detectInBrowser(), [])

  // An album that was deleted must not leave the view pointing at a ghost.
  const activeAlbum = view.kind === 'album' ? albums.find((a) => a.id === view.id) : undefined
  const viewKind = view.kind === 'album' && !activeAlbum ? 'all' : view.kind

  const counts = useMemo(() => {
    const perAlbum: Record<string, number> = {}
    for (const p of photos) for (const id of p.albumIds) perAlbum[id] = (perAlbum[id] ?? 0) + 1
    return { all: photos.length, favorites: photos.filter((p) => p.favorite).length, albums: perAlbum }
  }, [photos])
  const tags = useMemo(() => tagCounts(photos), [photos])
  const visible = useMemo(
    () => filterPhotos(photos, { ...filter, albumId: activeAlbum?.id, favoritesOnly: viewKind === 'favorites' }),
    [photos, filter, activeAlbum?.id, viewKind],
  )

  const title = activeAlbum ? activeAlbum.name : viewKind === 'favorites' ? 'Favorites' : 'All photos'
  const inView = activeAlbum ? (counts.albums[activeAlbum.id] ?? 0) : viewKind === 'favorites' ? counts.favorites : counts.all
  const subtitle = !ready
    ? 'Loading…'
    : selecting
      ? `${checked.size} selected`
      : `${visible.length}${visible.length === inView ? '' : ` of ${inView}`} photo${inView === 1 ? '' : 's'}`

  const viewerPhoto = photos.find((p) => p.id === viewerId)
  const editingPhoto = photos.find((p) => p.id === editingId)
  // The photo before or after this one in the list on screen, if any.
  const neighborOf = (id: string | undefined, offset: number, go: (id: string) => void) => {
    const index = visible.findIndex((p) => p.id === id)
    const target = index >= 0 ? visible[index + offset] : undefined
    return target ? () => go(target.id) : undefined
  }
  const viewerIndex = visible.findIndex((p) => p.id === viewerId)

  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then(({ usage = 0, quota = 0 }) => setStorage(`${formatBytes(usage)} of ${formatBytes(quota)} used`))
      .catch(() => {})
  }, [photos])

  useEffect(() => {
    if (importErrors.length > 0) {
      toast.error(`${importErrors.length} photo${importErrors.length === 1 ? '' : 's'} could not be imported`, {
        description: importErrors.join('\n'),
        duration: 10000,
      })
    }
  }, [importErrors])

  const checkedIds = [...checked]
  const set = (patch: Partial<Filter>) => setFilter((f) => ({ ...f, ...patch }))

  const stopSelecting = () => {
    setSelecting(false)
    setChecked(new Set())
  }

  const selectView = (next: LibraryView) => {
    setView(next)
    setMenuOpen(false)
    setChecked(new Set())
  }

  const toggleChecked = (id: string) =>
    setChecked((old) => {
      const next = new Set(old)
      if (!next.delete(id)) next.add(id)
      return next
    })

  // The welcome screen shows on the first visit while the library is empty, until the person picks a way in.
  // The "Photo Studio" name in the sidebar brings it back at any time.
  const showLanding = landingRequested || (!landingSeen && (!ready || photos.length === 0))
  const leaveLanding = () => {
    markLandingSeen()
    setLandingSeen(true)
    setLandingRequested(false)
  }

  const doImport = (files: File[]) => {
    if (files.length > 0) leaveLanding()
    return lib.importFiles(files, activeAlbum?.id)
  }
  const openUpload = () => inputRef.current?.click()

  const sidebar = (
    <Sidebar
      view={activeAlbum ? view : { kind: viewKind === 'favorites' ? 'favorites' : 'all' }}
      albums={albums}
      counts={counts}
      storage={storage}
      capabilities={capabilities}
      disabled={!ready || !!progress}
      onSelectView={selectView}
      onNewAlbum={() => {
        setMenuOpen(false)
        setAlbumDialog('create')
      }}
      onUpload={() => {
        setMenuOpen(false)
        openUpload()
      }}
      onHome={() => {
        setMenuOpen(false)
        setLandingRequested(true)
      }}
      piUser={pi.user}
      piBusy={pi.busy}
      onPiSignIn={pi.signIn}
      onPiSignOut={pi.signOut}
    />
  )

  return (
    <TooltipProvider>
      <div
        className="flex h-dvh bg-background text-foreground"
        inert={showLanding}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          doImport([...e.dataTransfer.files].filter((f) => f.type.startsWith('image/')))
        }}
      >
        <aside className="hidden w-80 shrink-0 border-r md:block">{sidebar}</aside>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="left" showCloseButton={false} className="w-[85vw] max-w-80 gap-0 p-0 md:hidden">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <SheetDescription className="sr-only">Albums and upload</SheetDescription>
            {sidebar}
          </SheetContent>
        </Sheet>

        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <LibraryHeader
            title={title}
            subtitle={subtitle}
            filter={filter}
            tags={tags}
            selecting={selecting}
            canSelect={photos.length > 0}
            uploadDisabled={!ready || !!progress}
            onRenameAlbum={activeAlbum ? () => setAlbumDialog('rename') : undefined}
            onDeleteAlbum={activeAlbum ? () => setConfirm('album') : undefined}
            onFilterChange={set}
            onToggleSelect={() => (selecting ? stopSelecting() : setSelecting(true))}
            onOpenMenu={() => setMenuOpen(true)}
            onUpload={openUpload}
          />

          <div className="flex flex-1 flex-col px-4 py-4 md:px-8 md:py-6">
            {ready && !lib.canSaveFiles && (
              <p role="alert" className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-300">
                This browser can’t save photos here. If you’re in a Private tab, open the site in a normal tab to keep your photos.
              </p>
            )}
            {error && (
              <p role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            )}
            {progress && (
              <div className="mb-4 grid gap-2" role="status">
                <p className="text-sm text-muted-foreground">
                  Importing {Math.min(progress.done + 1, progress.total)} of {progress.total}…
                </p>
                <Progress value={(progress.done / progress.total) * 100} />
              </div>
            )}

            {!ready ? (
              <GridSkeleton />
            ) : photos.length === 0 ? (
              <EmptyLibrary onUpload={openUpload} disabled={!!progress} />
            ) : visible.length === 0 ? (
              <NoMatches />
            ) : (
              <PhotoGrid photos={visible} selecting={selecting} checked={checked} onOpen={setViewerId} onToggle={toggleChecked} />
            )}

            {selecting && (
              <SelectionBar
                count={checked.size}
                albums={albums}
                activeAlbum={activeAlbum}
                onSelectAll={() => setChecked(new Set(visible.map((p) => p.id)))}
                onFavorite={() => lib.updatePhotos(checkedIds, (p) => ({ ...p, favorite: true }))}
                onAddToAlbum={(id) =>
                  lib.updatePhotos(checkedIds, (p) => ({ ...p, albumIds: p.albumIds.includes(id) ? p.albumIds : [...p.albumIds, id] }))
                }
                onRemoveFromAlbum={() =>
                  activeAlbum &&
                  lib.updatePhotos(checkedIds, (p) => ({ ...p, albumIds: p.albumIds.filter((a) => a !== activeAlbum.id) }))
                }
                onTag={(tag) => lib.updatePhotos(checkedIds, (p) => ({ ...p, tags: addTag(p.tags, tag) }))}
                // Export in the order shown on screen, not the order they were ticked.
                onExport={() => setExportItems(visible.filter((p) => checked.has(p.id)).map((p) => ({ photo: p, edits: p.edits })))}
                onDelete={() => setConfirm('photos')}
              />
            )}
          </div>
        </main>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            doImport([...(e.target.files ?? [])])
            e.target.value = ''
          }}
        />
      </div>

      {/* While the editor is open it replaces the viewer; closing it brings the viewer back. */}
      {viewerPhoto && !editingPhoto && (
        <PhotoViewer
          photo={viewerPhoto}
          position={{ index: Math.max(viewerIndex, 0), total: Math.max(visible.length, 1) }}
          albums={albums}
          knownTags={tags.map((t) => t.tag)}
          getOriginal={lib.getOriginal}
          savePreview={lib.savePreview}
          onPrev={neighborOf(viewerId, -1, setViewerId)}
          onNext={neighborOf(viewerId, 1, setViewerId)}
          onClose={() => setViewerId(undefined)}
          onChange={(change) => lib.updatePhotos([viewerPhoto.id], change)}
          onCreateAlbum={lib.createAlbum}
          onEdit={() => setEditingId(viewerPhoto.id)}
          onExport={() => setExportItems([{ photo: viewerPhoto, edits: viewerPhoto.edits }])}
          onDelete={() => setConfirm('photo')}
          onRevert={() => setConfirm('revert')}
        />
      )}

      <Suspense fallback={null}>
        {editingPhoto && (
          <Editor
            key={editingPhoto.id}
            photo={editingPhoto}
            getOriginal={lib.getOriginal}
            onSave={(edits, thumb) => lib.saveEdits(editingPhoto.id, edits, thumb)}
            onClose={() => {
              // Return to the viewer on the photo that was last edited.
              setViewerId(editingPhoto.id)
              setEditingId(undefined)
            }}
            onExport={(edits) => setExportItems([{ photo: editingPhoto, edits }])}
            onPrev={neighborOf(editingId, -1, setEditingId)}
            onNext={neighborOf(editingId, 1, setEditingId)}
          />
        )}

        {exportItems && <ExportDialog items={exportItems} getOriginal={lib.getOriginal} onClose={() => setExportItems(undefined)} />}
      </Suspense>

      <NameDialog
        open={albumDialog !== undefined}
        title={albumDialog === 'rename' ? 'Rename album' : 'New album'}
        initial={albumDialog === 'rename' ? activeAlbum?.name : ''}
        submitLabel={albumDialog === 'rename' ? 'Save' : 'Create'}
        onClose={() => setAlbumDialog(undefined)}
        onSubmit={async (name) => {
          if (albumDialog === 'rename' && activeAlbum) await lib.renameAlbum(activeAlbum.id, name)
          else {
            const album = await lib.createAlbum(name)
            if (album) selectView({ kind: 'album', id: album.id })
          }
          setAlbumDialog(undefined)
        }}
      />

      <ConfirmDialog
        open={confirm === 'album'}
        title={`Delete “${activeAlbum?.name ?? 'album'}”?`}
        description="The album is removed, but its photos stay in your library."
        confirmLabel="Delete album"
        onClose={() => setConfirm(undefined)}
        onConfirm={async () => {
          if (activeAlbum) await lib.deleteAlbum(activeAlbum.id)
          setConfirm(undefined)
          setView({ kind: 'all' })
        }}
      />

      <ConfirmDialog
        open={confirm === 'photos'}
        title={`Delete ${checked.size} photo${checked.size === 1 ? '' : 's'}?`}
        description="This removes them from your library on this device. It can't be undone."
        confirmLabel="Delete"
        onClose={() => setConfirm(undefined)}
        onConfirm={async () => {
          await lib.removePhotos(checkedIds)
          setConfirm(undefined)
          stopSelecting()
        }}
      />

      <ConfirmDialog
        open={confirm === 'photo'}
        title="Delete this photo?"
        description="This removes it from your library on this device. It can't be undone."
        confirmLabel="Delete"
        onClose={() => setConfirm(undefined)}
        onConfirm={async () => {
          if (viewerPhoto) {
            // Move on to a neighbor so the viewer stays open when there are more photos.
            const next = visible[viewerIndex + 1] ?? visible[viewerIndex - 1]
            await lib.removePhotos([viewerPhoto.id])
            setViewerId(next && next.id !== viewerPhoto.id ? next.id : undefined)
          }
          setConfirm(undefined)
        }}
      />

      <ConfirmDialog
        open={confirm === 'revert'}
        title="Revert to the original?"
        description="All edits to this photo are removed. The original file is not affected."
        confirmLabel="Revert"
        onClose={() => setConfirm(undefined)}
        onConfirm={async () => {
          setConfirm(undefined)
          if (!viewerPhoto) return
          try {
            const original = await lib.getOriginal(viewerPhoto.id)
            if (!original) throw new Error('The original file is missing')
            await lib.saveEdits(viewerPhoto.id, defaultEdits, await makeOriginalThumb(original, viewerPhoto))
            toast.success('Reverted to the original')
          } catch {
            toast.error('Could not revert this photo')
          }
        }}
      />

      {showLanding && <Landing disabled={!ready || !!progress} onUpload={openUpload} onOpenLibrary={leaveLanding} />}

      <Toaster position="top-center" />
    </TooltipProvider>
  )
}

export default App
