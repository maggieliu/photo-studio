import { describe, expect, it } from 'vitest'
import { canHaveAlpha } from './decode'

describe('canHaveAlpha', () => {
  it('is true for formats that can be transparent', () => {
    for (const type of ['image/png', 'image/webp', 'image/gif', 'image/avif', 'IMAGE/PNG']) {
      expect(canHaveAlpha(type)).toBe(true)
    }
  })

  it('is false for photo formats and unknown types', () => {
    for (const type of ['image/jpeg', 'image/heic', 'image/heif', '', 'text/plain']) {
      expect(canHaveAlpha(type)).toBe(false)
    }
  })
})
