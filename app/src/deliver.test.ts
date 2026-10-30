import { unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { zipFiles } from './deliver'

describe('zipFiles', () => {
  it('produces a zip that contains every file unchanged', async () => {
    const a = new File([new Uint8Array([1, 2, 3, 4])], 'a.jpg', { type: 'image/jpeg' })
    const b = new File([new Uint8Array([9, 8, 7])], 'b-edited.jpg', { type: 'image/jpeg' })
    const blob = await zipFiles([a, b])
    expect(blob.type).toBe('application/zip')

    const entries = unzipSync(new Uint8Array(await blob.arrayBuffer()))
    expect(Object.keys(entries).sort()).toEqual(['a.jpg', 'b-edited.jpg'])
    expect([...entries['a.jpg']]).toEqual([1, 2, 3, 4])
    expect([...entries['b-edited.jpg']]).toEqual([9, 8, 7])
  })

  it('handles an empty list', async () => {
    const blob = await zipFiles([])
    expect(unzipSync(new Uint8Array(await blob.arrayBuffer()))).toEqual({})
  })
})
