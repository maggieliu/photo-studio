const STORAGE_KEY = 'photo-studio:landing-seen'

/** Whether the person has already used the landing page, so it is only shown the first time. */
export function readLandingSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function markLandingSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // Private browsing or blocked storage: the landing page may show again next time.
  }
}
