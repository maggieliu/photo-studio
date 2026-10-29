import { describe, expect, it } from 'vitest'
import { detectCapabilities } from './capabilities'

const by = (r: ReturnType<typeof detectCapabilities>) =>
  Object.fromEntries(r.map((c) => [c.key, c.supported]))

describe('detectCapabilities', () => {
  it('reports everything unsupported for an empty environment', () => {
    expect(Object.values(by(detectCapabilities({}))).every((v) => !v)).toBe(true)
  })

  it('detects supported features', () => {
    const result = by(
      detectCapabilities({
        document: { createElement: () => ({ getContext: () => ({}) }) as never },
        navigator: { storage: { getDirectory: () => {} } },
        indexedDB: {},
        Worker: function () {},
        createImageBitmap: () => {},
        OffscreenCanvas: function () {},
      }),
    )
    expect(Object.values(result).every(Boolean)).toBe(true)
  })

  it('treats a throwing canvas as no WebGL2', () => {
    const result = by(
      detectCapabilities({
        document: {
          createElement: () => {
            throw new Error('boom')
          },
        },
      }),
    )
    expect(result.webgl2).toBe(false)
  })
})
