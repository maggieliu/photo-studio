import { describe, expect, it } from 'vitest'
import { COALESCE_MS, createHistory, push, redo, undo } from './history'

describe('history', () => {
  it('pushes, undoes and redoes', () => {
    let h = createHistory(0)
    h = push(h, 1, undefined, 0)
    h = push(h, 2, undefined, 0)
    expect(h.present).toBe(2)
    h = undo(h)
    expect(h.present).toBe(1)
    h = undo(h)
    expect(h.present).toBe(0)
    expect(undo(h)).toBe(h)
    h = redo(h)
    expect(h.present).toBe(1)
    h = redo(redo(h))
    expect(h.present).toBe(2)
  })

  it('drops the redo stack on a new change', () => {
    let h = push(push(createHistory(0), 1, undefined, 0), 2, undefined, 0)
    h = push(undo(h), 9, undefined, 0)
    expect(h.future).toEqual([])
    expect(h.present).toBe(9)
  })

  it('ignores a change to the same value', () => {
    const h = createHistory({ a: 1 })
    expect(push(h, h.present)).toBe(h)
  })

  it('coalesces quick changes to the same control into one step', () => {
    let h = createHistory(0)
    h = push(h, 1, 'exposure', 1000)
    h = push(h, 2, 'exposure', 1100)
    h = push(h, 3, 'exposure', 1200)
    expect(h.past).toEqual([0])
    expect(undo(h).present).toBe(0)
  })

  it('starts a new step after the window or for another control', () => {
    let h = push(createHistory(0), 1, 'exposure', 1000)
    h = push(h, 2, 'exposure', 1000 + COALESCE_MS + 1)
    expect(h.past).toEqual([0, 1])
    h = push(h, 3, 'contrast', 1000 + COALESCE_MS + 2)
    expect(h.past).toEqual([0, 1, 2])
  })

  it('does not coalesce right after an undo', () => {
    let h = push(createHistory(0), 1, 'exposure', 1000)
    h = undo(h)
    h = push(h, 5, 'exposure', 1001)
    expect(h.past).toEqual([0])
    expect(h.present).toBe(5)
  })
})
