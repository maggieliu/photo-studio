export type CapabilityResult = {
  key: string
  label: string
  supported: boolean
  detail?: string
}

type Env = {
  document?: Pick<Document, 'createElement'>
  navigator?: { storage?: { getDirectory?: unknown } }
  indexedDB?: unknown
  Worker?: unknown
  createImageBitmap?: unknown
  OffscreenCanvas?: unknown
  showOpenFilePicker?: unknown
}

export function detectCapabilities(env: Env): CapabilityResult[] {
  let webgl2 = false
  try {
    const canvas = env.document?.createElement('canvas') as HTMLCanvasElement | undefined
    webgl2 = !!canvas?.getContext('webgl2')
  } catch {
    webgl2 = false
  }

  return [
    { key: 'webgl2', label: 'WebGL2 (live edit preview)', supported: webgl2 },
    {
      key: 'opfs',
      label: 'OPFS (private file storage)',
      supported: typeof env.navigator?.storage?.getDirectory === 'function',
    },
    { key: 'indexeddb', label: 'IndexedDB (catalog)', supported: !!env.indexedDB },
    { key: 'worker', label: 'Web Workers', supported: typeof env.Worker === 'function' },
    {
      key: 'imagebitmap',
      label: 'createImageBitmap (fast decode)',
      supported: typeof env.createImageBitmap === 'function',
    },
    {
      key: 'offscreen',
      label: 'OffscreenCanvas (worker export)',
      supported: typeof env.OffscreenCanvas === 'function',
    },
  ]
}

export function detectInBrowser(): CapabilityResult[] {
  return detectCapabilities({
    document,
    navigator,
    indexedDB: globalThis.indexedDB,
    Worker: globalThis.Worker,
    createImageBitmap: globalThis.createImageBitmap,
    OffscreenCanvas: globalThis.OffscreenCanvas,
  })
}
