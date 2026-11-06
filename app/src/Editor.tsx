import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Crop as CropIcon,
  FlipHorizontal2,
  Loader2,
  Palette,
  Redo2,
  RotateCcw,
  RotateCw,
  Share2,
  Sparkles,
  Sun,
  Undo2,
  Wand2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { CROP_ICONS, SLIDER_ICONS } from './adjustmentIcons'
import { AdjustmentPicker, type AdjustmentItem } from './components/AdjustmentPicker'
import { SliderRow } from './components/SliderRow'
import { decodeForEditing } from './decode'
import {
  applyPreset,
  CROP_ASPECTS,
  defaultEdits,
  isDefaultEdits,
  normalizeEdits,
  PRESETS,
  rotateBy,
  SLIDERS,
  type EditSettings,
  type SliderDef,
} from './edits'
import { createHistory, push, redo, undo } from './history'
import { THUMB_SIZE } from './imageMeta'
import { Renderer } from './renderer'
import type { LibraryPhoto } from './useLibrary'

const PREVIEW_MAX = 2048

type Tab = 'light' | 'color' | 'detail' | 'crop' | 'presets'
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'light', label: 'Light', icon: <Sun /> },
  { id: 'color', label: 'Color', icon: <Palette /> },
  { id: 'detail', label: 'Detail', icon: <Sparkles /> },
  { id: 'crop', label: 'Crop', icon: <CropIcon /> },
  { id: 'presets', label: 'Presets', icon: <Wand2 /> },
]

type Props = {
  photo: LibraryPhoto
  getOriginal: (id: string) => Promise<Blob | undefined>
  onSave: (edits: EditSettings, thumb: Blob) => void | Promise<void>
  onClose: () => void
  /** Called with the current edits, which may be newer than the saved ones. */
  onExport: (edits: EditSettings) => void
  onPrev?: () => void
  onNext?: () => void
}

export function Editor({ photo, getOriginal, onSave, onClose, onExport, onPrev, onNext }: Props) {
  const [hist, setHist] = useState(() => createHistory(normalizeEdits(photo.edits)))
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string>()
  const [tab, setTab] = useState<Tab>('light')
  const [comparing, setComparing] = useState(false)
  const [restoreTick, setRestoreTick] = useState(0)
  // Which adjustment is showing in each tab.
  const [picked, setPicked] = useState<Record<'light' | 'color' | 'crop', string>>({ light: 'exposure', color: 'temperature', crop: 'zoom' })

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<Renderer | null>(null)
  const initialRef = useRef(hist.present)
  const editsRef = useRef(hist.present)
  const dirtyRef = useRef(false)
  const onSaveRef = useRef(onSave)

  const edits = hist.present
  const change = useCallback(
    (patch: Partial<EditSettings>, key?: string) => setHist((h) => push(h, { ...h.present, ...patch }, key)),
    [],
  )

  useEffect(() => {
    editsRef.current = edits
    onSaveRef.current = onSave
  })

  // Saves the current edits and a fresh thumbnail. The thumbnail frame is
  // captured synchronously, so the renderer can be disposed right after.
  const persist = useCallback((redraw: boolean) => {
    const renderer = rendererRef.current
    if (!dirtyRef.current || !renderer?.sourceSize) return
    dirtyRef.current = false
    const saved = editsRef.current
    renderer
      .toBlob(saved, THUMB_SIZE)
      .then((thumb) => onSaveRef.current(saved, thumb))
      .catch(() => {
        dirtyRef.current = true
      })
    if (redraw) renderer.render(saved, PREVIEW_MAX)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    ;(async () => {
      let renderer: Renderer
      try {
        renderer = new Renderer(canvas)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not start the editor')
        setStatus('error')
        return
      }
      renderer.onContextRestored = () => setRestoreTick((t) => t + 1)
      rendererRef.current = renderer
      try {
        const blob = await getOriginal(photo.id)
        if (!blob) throw new Error('The original file is missing')
        const bitmap = await decodeForEditing(blob, photo, PREVIEW_MAX)
        if (cancelled) return bitmap.close()
        renderer.setSource(bitmap)
        setStatus('ready')
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Could not open this photo')
        setStatus('error')
      }
    })()
    return () => {
      cancelled = true
      persist(false)
      rendererRef.current?.dispose()
      rendererRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one renderer per photo
  }, [photo.id])

  // Autosave after a pause, but never while a finger is on the screen: saving
  // redraws the canvas and would hitch a slider drag in progress.
  const touchingRef = useRef(false)
  useEffect(() => {
    const down = () => (touchingRef.current = true)
    const up = () => (touchingRef.current = false)
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [])

  useEffect(() => {
    if (edits === initialRef.current) return
    dirtyRef.current = true
    let timer: ReturnType<typeof setTimeout>
    const trySave = () => {
      if (touchingRef.current) timer = setTimeout(trySave, 500)
      else persist(true)
    }
    timer = setTimeout(trySave, 1000)
    return () => clearTimeout(timer)
  }, [edits, persist])

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && persist(true)
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [persist])

  // While comparing, show the original colors but keep the framing.
  useEffect(() => {
    if (status !== 'ready') return
    const shown: EditSettings = comparing
      ? { ...defaultEdits, rotation: edits.rotation, flipH: edits.flipH, straighten: edits.straighten, crop: edits.crop }
      : edits
    const frame = requestAnimationFrame(() => rendererRef.current?.render(shown, PREVIEW_MAX))
    return () => cancelAnimationFrame(frame)
  }, [edits, comparing, status, restoreTick])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A dialog on top (such as export) has already used this key.
      if (e.defaultPrevented) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        setHist((h) => (e.shiftKey ? redo(h) : undo(h)))
      } else if (e.target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) {
        return
      } else if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') onPrev?.()
      else if (e.key === 'ArrowRight') onNext?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onPrev, onNext])

  const slider = (def: SliderDef) => (
    <SliderRow
      key={def.key}
      label={def.label}
      value={edits[def.key]}
      min={def.min}
      max={def.max}
      onChange={(v) => change({ [def.key]: v }, def.key)}
      onReset={() => change({ [def.key]: 0 })}
    />
  )

  const crop = edits.crop
  const setCrop = (patch: Partial<NonNullable<EditSettings['crop']>>, key?: string) =>
    change({ crop: { aspect: 0, zoom: 1, px: 0.5, py: 0.5, ...edits.crop, ...patch } }, key)

  const activeAspect =
    CROP_ASPECTS.find((a) => (a.aspect === 0 ? !crop || crop.aspect === 0 : crop !== null && Math.abs(crop.aspect - a.aspect) < 1e-6))?.label ?? ''
  // Crop size and position only apply once there is a crop; the position icons are greyed out until then.
  const cropItems: AdjustmentItem[] = [
    { id: 'zoom', label: 'Crop size', ...CROP_ICONS.zoom, value: Math.round((crop?.zoom ?? 1) * 100), min: 10, max: 100, resetValue: 100, format: (v) => `${v}%` },
    { id: 'px', label: 'Position left–right', ...CROP_ICONS.px, value: Math.round((crop?.px ?? 0.5) * 100), min: 0, max: 100, resetValue: 50, disabled: !crop },
    { id: 'py', label: 'Position up–down', ...CROP_ICONS.py, value: Math.round((crop?.py ?? 0.5) * 100), min: 0, max: 100, resetValue: 50, disabled: !crop },
    { id: 'straighten', label: 'Straighten', ...CROP_ICONS.straighten, value: edits.straighten, min: -45, max: 45, step: 0.5, format: (v) => `${v}°` },
  ]
  const changeCrop = (id: string, v: number) => {
    if (id === 'zoom') setCrop({ zoom: v / 100 }, 'crop-zoom')
    else if (id === 'px') setCrop({ px: v / 100 }, 'crop-px')
    else if (id === 'py') setCrop({ py: v / 100 }, 'crop-py')
    else change({ straighten: v }, 'straighten')
  }
  const resetCrop = (id: string) => {
    if (id === 'zoom') setCrop({ zoom: 1 })
    else if (id === 'px') setCrop({ px: 0.5 })
    else if (id === 'py') setCrop({ py: 0.5 })
    else change({ straighten: 0 })
  }
  const noFraming = !crop && edits.rotation === 0 && !edits.flipH && edits.straighten === 0

  return (
    <div role="dialog" aria-label={`Edit ${photo.name}`} className="fixed inset-0 z-40 flex flex-col bg-background text-foreground md:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-1">
          <Button variant="outline" className="h-11 px-4 text-base" onClick={onClose}>
            Done
          </Button>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
            <Button variant="ghost" size="icon" className="size-11" onClick={onPrev} disabled={!onPrev} aria-label="Previous photo">
              <ChevronLeft className="size-6" />
            </Button>
            <span className="min-w-0 max-w-40 truncate text-sm font-medium">{photo.name}</span>
            <Button variant="ghost" size="icon" className="size-11" onClick={onNext} disabled={!onNext} aria-label="Next photo">
              <ChevronRight className="size-6" />
            </Button>
          </div>
          <Button className="h-11 gap-2 px-4 text-base font-bold" onClick={() => onExport(edits)} disabled={status !== 'ready'}>
            <Share2 /> Export
          </Button>
        </header>

        <div className="relative flex min-h-0 flex-1 items-center justify-center p-2">
          <canvas ref={canvasRef} className={cn('max-h-full max-w-full rounded-sm', status !== 'ready' && 'hidden')} />
          {status === 'loading' && (
            <p role="status" className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" /> Loading photo…
            </p>
          )}
          {status === 'error' && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}

        </div>

        {status === 'ready' && (
          <div className="flex items-center justify-between gap-2 px-3 pb-2">
            <div className="flex gap-1.5">
              <Button variant="outline" size="icon" className="size-11" onClick={() => setHist(undo)} disabled={hist.past.length === 0} aria-label="Undo">
                <Undo2 />
              </Button>
              <Button variant="outline" size="icon" className="size-11" onClick={() => setHist(redo)} disabled={hist.future.length === 0} aria-label="Redo">
                <Redo2 />
              </Button>
            </div>
            <Button
              variant="outline"
              className="h-11 touch-none text-sm select-none"
              style={{ WebkitTouchCallout: 'none' }}
              onPointerDown={() => setComparing(true)}
              onPointerUp={() => setComparing(false)}
              onPointerLeave={() => setComparing(false)}
              onPointerCancel={() => setComparing(false)}
              onContextMenu={(e) => e.preventDefault()}
            >
              Hold to compare
            </Button>
          </div>
        )}
      </div>

      <aside className="flex max-h-[44dvh] min-h-60 shrink-0 flex-col md:min-h-0 border-t bg-card md:max-h-none md:w-96 md:border-t-0 md:border-l pt-1 md:pt-[max(1rem,env(safe-area-inset-top))]">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="min-h-0 flex-1 gap-0">
          <TabsList className="h-auto w-full shrink-0 rounded-none bg-transparent px-2 py-1 group-data-horizontal/tabs:h-auto">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="h-auto flex-col gap-0.5 py-1.5 text-xs">
                {t.icon}
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {(['light', 'color'] as const).map((group) => (
              <TabsContent key={group} value={group}>
                <AdjustmentPicker
                  items={SLIDERS.filter((s) => s.group === group).map(
                    (def): AdjustmentItem => ({ id: def.key, label: def.label, ...SLIDER_ICONS[def.key], value: edits[def.key], min: def.min, max: def.max }),
                  )}
                  active={picked[group]}
                  onActiveChange={(id) => setPicked((p) => ({ ...p, [group]: id }))}
                  onChange={(id, v) => change({ [id]: v } as Partial<EditSettings>, id)}
                  onReset={(id) => change({ [id]: 0 } as Partial<EditSettings>)}
                />
              </TabsContent>
            ))}
            <TabsContent value="detail">{SLIDERS.filter((s) => s.group === 'detail').map(slider)}</TabsContent>

            <TabsContent value="crop" className="grid gap-3">
              <div className="grid gap-1.5">
                <span className="text-sm font-medium">Aspect ratio</span>
                <Select
                  value={activeAspect || 'Original'}
                  onValueChange={(label) => {
                    const a = CROP_ASPECTS.find((x) => x.label === label)
                    if (!a) return
                    if (a.aspect === 0 && (!crop || crop.zoom === 1)) change({ crop: null })
                    else setCrop({ aspect: a.aspect })
                  }}
                >
                  <SelectTrigger className="h-11 w-full text-base" aria-label="Aspect ratio">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CROP_ASPECTS.map((a) => (
                      <SelectItem key={a.label} value={a.label} className="min-h-10 text-base">
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <AdjustmentPicker
                label="Choose a crop adjustment"
                items={cropItems}
                active={picked.crop}
                onActiveChange={(id) => setPicked((p) => ({ ...p, crop: id }))}
                onChange={changeCrop}
                onReset={resetCrop}
              />

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11"
                  aria-label="Rotate left"
                  title="Rotate left"
                  onClick={() => setHist((h) => push(h, rotateBy(h.present, -1)))}
                >
                  <RotateCcw />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11"
                  aria-label="Rotate right"
                  title="Rotate right"
                  onClick={() => setHist((h) => push(h, rotateBy(h.present, 1)))}
                >
                  <RotateCw />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className={cn('size-11', edits.flipH && 'border-ring bg-accent text-accent-foreground')}
                  aria-label="Flip horizontally"
                  title="Flip horizontally"
                  aria-pressed={edits.flipH}
                  onClick={() => change({ flipH: !edits.flipH })}
                >
                  <FlipHorizontal2 />
                </Button>
                <Button
                  variant="ghost"
                  className="ml-auto h-11"
                  disabled={noFraming}
                  onClick={() => change({ crop: null, rotation: 0, flipH: false, straighten: 0 })}
                >
                  Reset framing
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="presets" className="grid gap-3">
              <ul className="grid grid-cols-2 gap-2">
                {PRESETS.map((p) => (
                  <li key={p.name}>
                    <Button variant="outline" className="h-12 w-full text-base" onClick={() => setHist((h) => push(h, applyPreset(h.present, p)))}>
                      {p.name}
                    </Button>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">Presets set the Light, Color and Detail sliders. Your crop stays as it is.</p>
            </TabsContent>

            <Button
              variant="ghost"
              className="mt-3 h-11 w-full text-destructive hover:text-destructive"
              disabled={isDefaultEdits(edits)}
              onClick={() => setHist((h) => push(h, defaultEdits))}
            >
              Reset all edits
            </Button>
          </div>
        </Tabs>
      </aside>
    </div>
  )
}
