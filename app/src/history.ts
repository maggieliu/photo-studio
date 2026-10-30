export type History<T> = {
  past: T[]
  present: T
  future: T[]
  lastKey?: string
  lastAt: number
}

/** Edits to the same control within this window collapse into one undo step. */
export const COALESCE_MS = 700

export const createHistory = <T>(initial: T): History<T> => ({ past: [], present: initial, future: [], lastAt: 0 })

export function push<T>(h: History<T>, value: T, key?: string, now = Date.now()): History<T> {
  if (Object.is(value, h.present)) return h
  if (key && key === h.lastKey && now - h.lastAt < COALESCE_MS) {
    return { ...h, present: value, future: [], lastAt: now }
  }
  return { past: [...h.past, h.present], present: value, future: [], lastKey: key, lastAt: now }
}

export function undo<T>(h: History<T>): History<T> {
  if (h.past.length === 0) return h
  return {
    past: h.past.slice(0, -1),
    present: h.past[h.past.length - 1],
    future: [h.present, ...h.future],
    lastAt: 0,
  }
}

export function redo<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h
  return {
    past: [...h.past, h.present],
    present: h.future[0],
    future: h.future.slice(1),
    lastAt: 0,
  }
}
