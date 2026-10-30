import { useCallback, useEffect, useRef, useState } from 'react'
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
const TABS: { id: Tab; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'color', label: 'Color' },
  { id: 'detail', label: 'Detail' },
  { id: 'crop', label: 'Crop' },
  { id: 'presets', label: 'Presets' },
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

type SliderRowProps = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  /** The value the reset button restores; the button only shows when it differs. */
  resetValue?: number
  format?: (v: number) => string
  onChange: (v: number) => void
  onReset: () => void
}

function SliderRow({ label, value, min, max, step = 1, resetValue = 0, format, onChange, onReset }: SliderRowProps) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="slider">
      <span className="slider-label">{label}</span>
      <output>{format ? format(value) : value}</output>
      <button
        type="button"
        className="slider-reset"
        onClick={onReset}
        aria-label={`Reset ${label}`}
        // Keeps its place in the grid so the row doesn't jump when it appears.
        style={{ visibility: value === resetValue ? 'hidden' : 'visible' }}
      >
        ↺
      </button>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--pct': `${pct}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

export function Editor({ photo, getOriginal, onSave, onClose, onExport, onPrev, onNext }: Props) {
  const [hist, setHist] = useState(() => createHistory(normalizeEdits(photo.edits)))
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string>()
  const [tab, setTab] = useState<Tab>('light')
  const [comparing, setComparing] = useState(false)
  const [restoreTick, setRestoreTick] = useState(0)

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

  return (
    <div className="editor" role="dialog" aria-label={`Edit ${photo.name}`}>
      <header className="editor-bar">
        <button type="button" onClick={onClose}>
          Done
        </button>
        <div className="editor-nav">
          <button type="button" onClick={onPrev} disabled={!onPrev} aria-label="Previous photo">
            ‹
          </button>
          <span className="editor-name">{photo.name}</span>
          <button type="button" onClick={onNext} disabled={!onNext} aria-label="Next photo">
            ›
          </button>
        </div>
        <button type="button" className="primary" onClick={() => onExport(edits)} disabled={status !== 'ready'}>
          Export
        </button>
      </header>

      <div className="editor-stage">
        <canvas ref={canvasRef} className={status === 'ready' ? undefined : 'hidden'} />
        {status === 'loading' && <p role="status">Loading photo…</p>}
        {status === 'error' && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {status === 'ready' && (
          <div className="editor-undo">
            <button type="button" onClick={() => setHist(undo)} disabled={hist.past.length === 0} aria-label="Undo">
              ↶
            </button>
            <button type="button" onClick={() => setHist(redo)} disabled={hist.future.length === 0} aria-label="Redo">
              ↷
            </button>
          </div>
        )}
        {status === 'ready' && (
          <button
            type="button"
            className="compare"
            onPointerDown={() => setComparing(true)}
            onPointerUp={() => setComparing(false)}
            onPointerLeave={() => setComparing(false)}
            onPointerCancel={() => setComparing(false)}
            onContextMenu={(e) => e.preventDefault()}
          >
            Hold to compare
          </button>
        )}
      </div>

      <nav className="editor-tabs" aria-label="Editing tools">
        {TABS.map((t) => (
          <button key={t.id} type="button" aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <section className="editor-panel">
        {tab === 'light' && SLIDERS.filter((s) => s.group === 'light').map(slider)}
        {tab === 'color' && SLIDERS.filter((s) => s.group === 'color').map(slider)}
        {tab === 'detail' && SLIDERS.filter((s) => s.group === 'detail').map(slider)}

        {tab === 'crop' && (
          <>
            <ul className="chips" aria-label="Crop shape">
              {CROP_ASPECTS.map((a) => {
                const active = a.aspect === 0 ? !crop || crop.aspect === 0 : crop?.aspect !== undefined && Math.abs(crop.aspect - a.aspect) < 1e-6
                return (
                  <li key={a.label}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        a.aspect === 0 && (!crop || crop.zoom === 1)
                          ? change({ crop: null })
                          : setCrop({ aspect: a.aspect })
                      }
                    >
                      {a.label}
                    </button>
                  </li>
                )
              })}
            </ul>
            <SliderRow
              label="Crop size"
              value={Math.round((crop?.zoom ?? 1) * 100)}
              min={10}
              max={100}
              resetValue={100}
              format={(v) => `${v}%`}
              onChange={(v) => setCrop({ zoom: v / 100 }, 'crop-zoom')}
              onReset={() => setCrop({ zoom: 1 })}
            />
            {crop && (
              <>
                <SliderRow
                  label="Position left–right"
                  value={Math.round(crop.px * 100)}
                  min={0}
                  max={100}
                  resetValue={50}
                  onChange={(v) => setCrop({ px: v / 100 }, 'crop-px')}
                  onReset={() => setCrop({ px: 0.5 })}
                />
                <SliderRow
                  label="Position up–down"
                  value={Math.round(crop.py * 100)}
                  min={0}
                  max={100}
                  resetValue={50}
                  onChange={(v) => setCrop({ py: v / 100 }, 'crop-py')}
                  onReset={() => setCrop({ py: 0.5 })}
                />
              </>
            )}
            <SliderRow
              label="Straighten"
              value={edits.straighten}
              min={-45}
              max={45}
              step={0.5}
              format={(v) => `${v}°`}
              onChange={(v) => change({ straighten: v }, 'straighten')}
              onReset={() => change({ straighten: 0 })}
            />
            <div className="row-buttons">
              <button type="button" onClick={() => setHist((h) => push(h, rotateBy(h.present, -1)))}>
                ⟲ Rotate left
              </button>
              <button type="button" onClick={() => setHist((h) => push(h, rotateBy(h.present, 1)))}>
                ⟳ Rotate right
              </button>
              <button type="button" aria-pressed={edits.flipH} onClick={() => change({ flipH: !edits.flipH })}>
                ⇋ Flip
              </button>
              {crop && crop.aspect > 0 && (
                <button type="button" onClick={() => setCrop({ aspect: 1 / crop.aspect })}>
                  Swap orientation
                </button>
              )}
              <button
                type="button"
                onClick={() => change({ crop: null, rotation: 0, flipH: false, straighten: 0 })}
                disabled={!crop && edits.rotation === 0 && !edits.flipH && edits.straighten === 0}
              >
                Reset framing
              </button>
            </div>
          </>
        )}

        {tab === 'presets' && (
          <>
            <ul className="chips" aria-label="Presets">
              {PRESETS.map((p) => (
                <li key={p.name}>
                  <button type="button" onClick={() => setHist((h) => push(h, applyPreset(h.present, p)))}>
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
            <p className="hint">Presets set the Light, Color and Detail sliders. Your crop stays as it is.</p>
          </>
        )}

        <button
          type="button"
          className="reset-all"
          disabled={isDefaultEdits(edits)}
          onClick={() => setHist((h) => push(h, defaultEdits))}
        >
          Reset all edits
        </button>
      </section>
    </div>
  )
}
