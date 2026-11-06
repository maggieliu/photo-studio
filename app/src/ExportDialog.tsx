import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Eye, Share2, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { canShareFiles, downloadBlob, shareFiles, zipFiles } from './deliver'
import {
  FORMATS,
  formatInfo,
  normalizeExportOptions,
  SIZE_PRESETS,
  supportedFormats,
  type ExportFormat,
  type ExportOptions,
  type SizeChoice,
} from './exportOptions'
import { runExport, type ExportItem, type ExportRun } from './exportPhoto'
import { formatBytes } from './imageMeta'

const STORAGE_KEY = 'photo-studio:export-options'

function loadOptions(): ExportOptions {
  try {
    return normalizeExportOptions(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'))
  } catch {
    return normalizeExportOptions(null)
  }
}

function saveOptions(options: ExportOptions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(options))
  } catch {
    // Private browsing or blocked storage: the choice just isn't remembered.
  }
}

const sizeId = (s: SizeChoice) => String(s)
const parseSize = (id: string): SizeChoice => (id === 'original' ? 'original' : Number(id))

type Props = {
  items: ExportItem[]
  getOriginal: (id: string) => Promise<Blob | undefined>
  onClose: () => void
}

export function ExportDialog({ items, getOriginal, onClose }: Props) {
  const formats = useMemo(() => supportedFormats(), [])
  const [options, setOptions] = useState(loadOptions)
  const [phase, setPhase] = useState<'options' | 'working' | 'done'>('options')
  const [progress, setProgress] = useState({ done: 0, total: items.length })
  const [run, setRun] = useState<ExportRun>()
  const [notice, setNotice] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [viewing, setViewing] = useState<number>()
  const cancelRef = useRef(false)
  const aliveRef = useRef(true)
  // Object URLs for the image viewer, made once per run and released with the dialog.
  const [urls, setUrls] = useState<string[]>([])
  const urlsRef = useRef<string[]>([])

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      cancelRef.current = true
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [])

  const format = formats.includes(options.format) ? options.format : 'jpeg'
  const info = formatInfo(format)
  const set = (patch: Partial<ExportOptions>) => setOptions((o) => ({ ...o, ...patch }))
  const isPreset = SIZE_PRESETS.some((p) => p.size === options.size)
  const customSize = isPreset ? '' : String(options.size)

  const start = async () => {
    const chosen = { ...options, format }
    saveOptions(chosen)
    cancelRef.current = false
    setNotice(undefined)
    setProgress({ done: 0, total: items.length })
    setPhase('working')
    try {
      const result = await runExport(items, chosen, getOriginal, {
        onProgress: (done, total) => aliveRef.current && setProgress({ done, total }),
        isCancelled: () => cancelRef.current,
      })
      if (!aliveRef.current) return
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u))
      urlsRef.current = result.files.map((f) => URL.createObjectURL(f.file))
      setUrls(urlsRef.current)
      setRun(result)
      setViewing(undefined)
      setPhase('done')
    } catch (e) {
      if (!aliveRef.current) return
      setRun({ files: [], errors: [e instanceof Error ? e.message : 'Export failed'], cancelled: false })
      setPhase('done')
    }
  }

  const files = run?.files.map((f) => f.file) ?? []
  const canShare = phase === 'done' && canShareFiles(files)
  const totalSize = files.reduce((sum, f) => sum + f.size, 0)
  // On a phone the share sheet is the way to save, and downloads are unreliable
  // in in-app browsers. If a share fails, downloads come back as a fallback.
  const isPhone = useMemo(() => window.matchMedia?.('(pointer: coarse)').matches ?? false, [])
  const [shareFailed, setShareFailed] = useState(false)
  const showDownload = !(isPhone && canShare) || shareFailed

  // Sharing needs a fresh tap, which is why this is a separate step after rendering.
  const share = async () => {
    setNotice(undefined)
    try {
      await shareFiles(files)
    } catch {
      setShareFailed(true)
      setNotice('Sharing did not work here. Use Download, or View and copy the image.')
    }
  }

  const download = async () => {
    setNotice(undefined)
    if (files.length === 1) return downloadBlob(files[0], files[0].name)
    setBusy(true)
    try {
      downloadBlob(await zipFiles(files), 'photo-studio-export.zip')
    } catch {
      setNotice('Could not create the zip file.')
    } finally {
      setBusy(false)
    }
  }

  const current = viewing !== undefined ? run?.files[viewing] : undefined

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto sm:max-w-md" aria-describedby="export-description">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            {phase === 'done' ? 'Export finished' : `Export ${items.length} photo${items.length === 1 ? '' : 's'}`}
          </DialogTitle>
          <DialogDescription id="export-description">
            {phase === 'options' && 'Choose a format and size. Your originals are not changed.'}
            {phase === 'working' && 'Rendering your photos. Keep this page open.'}
            {phase === 'done' && 'Your photos are ready to save.'}
          </DialogDescription>
        </DialogHeader>

        {phase === 'options' && (
          <>
            <section className="grid gap-2">
              <h3 className="text-sm font-bold">Format</h3>
              <ToggleGroup
                type="single"
                variant="outline"
                value={format}
                onValueChange={(v) => v && set({ format: v as ExportFormat })}
                aria-label="Format"
                className="flex-wrap"
              >
                {FORMATS.filter((f) => formats.includes(f.id)).map((f) => (
                  <ToggleGroupItem key={f.id} value={f.id} className="h-11 px-5 text-base data-[state=on]:border-ring data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
                    {f.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </section>

            {info.lossy && (
              <section className="grid gap-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">Quality</h3>
                  <output className="text-sm tabular-nums text-muted-foreground">{Math.max(40, options.quality)}</output>
                </div>
                <Slider
                  aria-label="Quality"
                  min={40}
                  max={100}
                  step={1}
                  value={[Math.max(40, options.quality)]}
                  onValueChange={([v]) => set({ quality: v })}
                />
              </section>
            )}

            <section className="grid gap-2">
              <h3 className="text-sm font-bold">Size (longest edge)</h3>
              <ToggleGroup
                type="single"
                variant="outline"
                value={isPreset ? sizeId(options.size) : ''}
                onValueChange={(v) => v && set({ size: parseSize(v) })}
                aria-label="Size"
                className="flex-wrap"
              >
                {SIZE_PRESETS.map((p) => (
                  <ToggleGroupItem key={p.label} value={sizeId(p.size)} className="h-11 px-4 text-base data-[state=on]:border-ring data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
                    {p.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Custom</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={16}
                  max={16384}
                  placeholder="px"
                  value={customSize}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    set({ size: e.target.value === '' || !Number.isFinite(n) ? 'original' : Math.max(16, Math.min(16384, Math.round(n))) })
                  }}
                  className="h-11 w-28 text-base"
                />
                <span className="text-muted-foreground">px</span>
              </label>
              <p className="text-xs text-muted-foreground">Photos are never scaled up.</p>
            </section>

            <DialogFooter>
              <Button variant="outline" className="h-11" onClick={onClose}>
                Cancel
              </Button>
              <Button className="h-11 px-6 font-bold" onClick={start}>
                Export
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === 'working' && (
          <>
            <div className="grid gap-2" role="status">
              <Progress value={(progress.done / Math.max(1, progress.total)) * 100} aria-label="Export progress" />
              <p className="text-sm text-muted-foreground">
                {progress.done < progress.total ? `Exporting ${progress.done + 1} of ${progress.total}…` : 'Finishing…'}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" className="h-11" onClick={() => (cancelRef.current = true)}>
                Stop after this photo
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === 'done' && run && current && viewing !== undefined && (
          <>
            <p className="text-sm font-semibold break-all">
              {current.file.name} · {current.width}×{current.height}
            </p>
            <img src={urls[viewing]} alt={current.file.name} className="max-h-[50dvh] w-full rounded-md bg-muted object-contain" style={{ WebkitTouchCallout: 'default' }} />
            <p className="text-xs text-muted-foreground">
              On a phone, touch and hold the image and choose “Copy”, then paste it into Notes, Messages or Files. If “Save to
              Photos” closes the app, use Copy instead. On a computer, right-click and choose “Save image as”.
            </p>
            <DialogFooter className="flex-row flex-wrap justify-end">
              <Button variant="outline" className="h-11 gap-1" disabled={viewing === 0} onClick={() => setViewing(viewing - 1)}>
                <ChevronLeft /> Previous
              </Button>
              <Button variant="outline" className="h-11 gap-1" disabled={viewing >= run.files.length - 1} onClick={() => setViewing(viewing + 1)}>
                Next <ChevronRight />
              </Button>
              <Button className="h-11" onClick={() => setViewing(undefined)}>
                Back
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === 'done' && run && viewing === undefined && (
          <>
            <p role="status" className="text-sm">
              {files.length > 0
                ? `${files.length} photo${files.length === 1 ? '' : 's'} ready · ${formatBytes(totalSize)}`
                : 'Nothing was exported.'}
              {run.cancelled && ' Stopped early.'}
            </p>

            {files.length > 0 && (
              <ul className="grid max-h-60 overflow-y-auto text-sm">
                {run.files.map((f, i) => (
                  <li key={f.file.name} className="grid gap-0.5 border-b py-2 last:border-0">
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setViewing(i)}
                        className="min-h-6 min-w-0 text-left font-medium break-all underline-offset-2 hover:underline"
                      >
                        {f.file.name}
                      </button>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {f.width}×{f.height} · {formatBytes(f.file.size)}
                      </span>
                    </div>
                    {f.reduced && (
                      <p className="flex items-center gap-1 text-xs text-amber-400">
                        <TriangleAlert className="size-3.5" /> Smaller than requested: this device could not render it larger.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {run.errors.length > 0 && (
              <ul role="alert" className="grid gap-1 text-sm text-destructive">
                {run.errors.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
            {notice && (
              <p role="alert" className="text-sm text-destructive">
                {notice}
              </p>
            )}

            <DialogFooter className="flex-row flex-wrap justify-end">
              <Button variant="outline" className="h-11" onClick={() => setPhase('options')}>
                Back
              </Button>
              {files.length > 0 && showDownload && (
                <Button variant="outline" className="h-11 gap-2" onClick={download} disabled={busy}>
                  <Download /> {files.length === 1 ? 'Download' : busy ? 'Zipping…' : 'Download .zip'}
                </Button>
              )}
              {files.length > 0 && (
                <Button variant={canShare ? 'outline' : 'default'} className="h-11 gap-2" onClick={() => setViewing(0)}>
                  <Eye /> {canShare ? 'View' : 'View & save'}
                </Button>
              )}
              {canShare && (
                <Button className="h-11 gap-2 font-bold" onClick={share}>
                  <Share2 /> Share / Save…
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
