import { useEffect, useMemo, useRef, useState } from 'react'
import { canShareFiles, downloadBlob, shareFiles, zipFiles } from './deliver'
import {
  FORMATS,
  formatInfo,
  normalizeExportOptions,
  SIZE_PRESETS,
  supportedFormats,
  type ExportOptions,
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
  // Object URLs for the viewer, made once per run and released with the dialog.
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
  const customSize = SIZE_PRESETS.some((p) => p.size === options.size) ? '' : String(options.size)

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

  return (
    <div className="export-overlay" role="dialog" aria-modal="true" aria-label="Export photos">
      <div className="export-card">
        <h2>
          Export {items.length} photo{items.length === 1 ? '' : 's'}
        </h2>

        {phase === 'options' && (
          <>
            <h3>Format</h3>
            <ul className="chips" aria-label="Format">
              {FORMATS.filter((f) => formats.includes(f.id)).map((f) => (
                <li key={f.id}>
                  <button type="button" aria-pressed={format === f.id} onClick={() => set({ format: f.id })}>
                    {f.label}
                  </button>
                </li>
              ))}
            </ul>

            {info.lossy && (
              <div className="slider">
                <span className="slider-label">Quality</span>
                <output>{options.quality}</output>
                <span />
                <input
                  type="range"
                  aria-label="Quality"
                  min={40}
                  max={100}
                  value={Math.max(40, options.quality)}
                  style={{ '--pct': `${((Math.max(40, options.quality) - 40) / 60) * 100}%` } as React.CSSProperties}
                  onChange={(e) => set({ quality: Number(e.target.value) })}
                />
              </div>
            )}

            <h3>Size (longest edge)</h3>
            <ul className="chips" aria-label="Size">
              {SIZE_PRESETS.map((p) => (
                <li key={p.label}>
                  <button type="button" aria-pressed={options.size === p.size} onClick={() => set({ size: p.size })}>
                    {p.label}
                  </button>
                </li>
              ))}
            </ul>
            <label className="custom-size">
              Custom
              <input
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
              />
              px
            </label>
            <p className="hint">Photos are never scaled up. Your originals are not changed.</p>

            <div className="actions">
              <button type="button" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="primary" onClick={start}>
                Export
              </button>
            </div>
          </>
        )}

        {phase === 'working' && (
          <>
            <progress max={progress.total} value={progress.done} aria-label="Export progress" />
            <p role="status">
              {progress.done < progress.total
                ? `Exporting ${progress.done + 1} of ${progress.total}…`
                : 'Finishing…'}
            </p>
            <div className="actions">
              <button type="button" onClick={() => (cancelRef.current = true)}>
                Stop after this photo
              </button>
            </div>
          </>
        )}

        {phase === 'done' && run && viewing !== undefined && run.files[viewing] && (
          <>
            <p className="viewer-name">
              {run.files[viewing].file.name} · {run.files[viewing].width}×{run.files[viewing].height}
            </p>
            <img className="viewer-image" src={urls[viewing]} alt={run.files[viewing].file.name} />
            <p className="hint">
              On a phone, touch and hold the image and choose “Copy”, then paste it into Notes, Messages or Files. If
              “Save to Photos” closes the app, use Copy instead. On a computer, right-click and choose “Save image as”.
            </p>
            <div className="actions">
              <button type="button" onClick={() => setViewing(viewing - 1)} disabled={viewing === 0}>
                ‹ Previous
              </button>
              <button type="button" onClick={() => setViewing(viewing + 1)} disabled={viewing >= run.files.length - 1}>
                Next ›
              </button>
              <button type="button" className="primary" onClick={() => setViewing(undefined)}>
                Back
              </button>
            </div>
          </>
        )}

        {phase === 'done' && run && viewing === undefined && (
          <>
            <p role="status">
              {files.length > 0
                ? `${files.length} photo${files.length === 1 ? '' : 's'} ready · ${formatBytes(totalSize)}`
                : 'Nothing was exported.'}
              {run.cancelled && ' Stopped early.'}
            </p>
            {files.length > 0 && (
              <ul className="export-files">
                {run.files.map((f, i) => (
                  <li key={f.file.name}>
                    <button type="button" className="link name" onClick={() => setViewing(i)}>
                      {f.file.name}
                    </button>
                    <span>
                      {f.width}×{f.height} · {formatBytes(f.file.size)}
                    </span>
                    {f.reduced && <span className="warn">Smaller than requested: this device could not render it larger.</span>}
                  </li>
                ))}
              </ul>
            )}
            {run.errors.length > 0 && (
              <ul className="error" role="alert">
                {run.errors.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
            {notice && (
              <p role="alert" className="error">
                {notice}
              </p>
            )}
            <div className="actions">
              <button type="button" onClick={() => setPhase('options')}>
                Back
              </button>
              {files.length > 0 && showDownload && (
                <button type="button" onClick={download} disabled={busy}>
                  {files.length === 1 ? 'Download' : busy ? 'Zipping…' : 'Download .zip'}
                </button>
              )}
              {files.length > 0 && (
                <button type="button" className={canShare ? undefined : 'primary'} onClick={() => setViewing(0)}>
                  {canShare ? 'View' : 'View & save'}
                </button>
              )}
              {canShare && (
                <button type="button" className="primary" onClick={share}>
                  Share / Save…
                </button>
              )}
              <button type="button" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
