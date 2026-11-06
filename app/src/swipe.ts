export type SwipeDirection = 'left' | 'right' | undefined

/**
 * Reads a finger drag as a horizontal swipe: long enough, and clearly more
 * sideways than up or down so scrolling and taps do not count.
 */
export function swipeDirection(dx: number, dy: number, minDistance = 50): SwipeDirection {
  if (Math.abs(dx) < minDistance) return undefined
  if (Math.abs(dx) < Math.abs(dy) * 1.5) return undefined
  return dx < 0 ? 'left' : 'right'
}
