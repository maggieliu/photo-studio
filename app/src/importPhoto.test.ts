import { describe, expect, it } from 'vitest'
import { describeStorageError } from './importPhoto'

describe('describeStorageError', () => {
  it('explains the Safari Private tab error in plain words', () => {
    const e = new Error('Error preparing Blob/File data to be stored in object store')
    const text = describeStorageError(e, 'IMG_1.heic')
    expect(text).toContain('IMG_1.heic')
    expect(text).toMatch(/Private tab/)
    expect(text).not.toMatch(/object store/)
  })

  it('treats data clone and unknown storage errors the same way', () => {
    const clone = new DOMException('x', 'DataCloneError')
    expect(describeStorageError(clone, 'a.jpg')).toMatch(/Private tab/)
    const unknown = new DOMException('x', 'UnknownError')
    expect(describeStorageError(unknown, 'a.jpg')).toMatch(/Private tab/)
  })

  it('reports a full device separately', () => {
    const e = new DOMException('The quota has been exceeded', 'QuotaExceededError')
    expect(describeStorageError(e, 'a.jpg')).toMatch(/no space left/)
  })

  it('falls back to a generic message', () => {
    expect(describeStorageError(new Error('boom'), 'a.jpg')).toBe('a.jpg: could not save this photo.')
    expect(describeStorageError('weird', 'a.jpg')).toBe('a.jpg: could not save this photo.')
  })
})
