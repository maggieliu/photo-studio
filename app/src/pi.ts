/**
 * Optional "Sign in with Pi". Everything Pi-specific lives here, so the rest of the app
 * does not depend on it and works the same outside Pi.
 *
 * Photo Studio has no server, so the username is only shown on screen. It is not proof of
 * identity, and the access token Pi returns is never kept.
 */

export type PiUser = { uid: string; username: string }

type PiAuthResult = { accessToken: string; user: { uid: string; username?: string } }

type PiSdk = {
  init(config: { version: string; sandbox?: boolean }): void
  authenticate(scopes: string[], onIncompletePaymentFound: (payment: unknown) => void): Promise<PiAuthResult>
}

declare global {
  interface Window {
    Pi?: PiSdk
  }
}

const SDK_URL = 'https://sdk.minepi.com/pi-sdk.js'
const SDK_VERSION = '2.0'
const SANDBOX_HOST = 'sandbox.minepi.com'
const STORAGE_KEY = 'photo-studio:pi-user'

/** How long to wait for Pi before giving up, for example when the page is not open in the Pi Browser. */
export const SIGN_IN_TIMEOUT_MS = 30_000

/** True when the page is being shown inside the Pi Sandbox, which needs the SDK's sandbox mode. */
export function looksLikePiSandbox(ancestorOrigins: readonly string[] | undefined, referrer: string): boolean {
  const hosts = [...(ancestorOrigins ?? []), referrer]
  return hosts.some((h) => {
    try {
      return new URL(h).hostname === SANDBOX_HOST
    } catch {
      return false
    }
  })
}

/** Reads the saved sign-in, ignoring anything that is not a well-formed user. */
export function parseStoredUser(raw: string | null): PiUser | undefined {
  if (!raw) return undefined
  try {
    const v = JSON.parse(raw) as Partial<PiUser>
    return typeof v.uid === 'string' && typeof v.username === 'string' && v.username !== '' ? { uid: v.uid, username: v.username } : undefined
  } catch {
    return undefined
  }
}

export function readStoredUser(): PiUser | undefined {
  try {
    return parseStoredUser(localStorage.getItem(STORAGE_KEY))
  } catch {
    return undefined
  }
}

function storeUser(user: PiUser | undefined) {
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Private browsing or blocked storage: the sign-in just is not remembered.
  }
}

/** A sentence for the person, whatever went wrong. */
export function describePiError(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (message === 'timeout' || message === 'sdk-load') {
    return 'Pi did not respond. Sign in works when Photo Studio is open in the Pi Browser.'
  }
  return 'Could not sign in with Pi. Please try again in the Pi Browser.'
}

let sdkPromise: Promise<PiSdk> | undefined

/** Loads Pi's script the first time it is needed, so people who never sign in never load it. */
function loadPiSdk(): Promise<PiSdk> {
  sdkPromise ??= new Promise<PiSdk>((resolve, reject) => {
    if (window.Pi) return resolve(window.Pi)
    const script = document.createElement('script')
    script.src = SDK_URL
    script.async = true
    script.onload = () => (window.Pi ? resolve(window.Pi) : reject(new Error('sdk-load')))
    script.onerror = () => reject(new Error('sdk-load'))
    document.head.append(script)
  }).catch((e) => {
    sdkPromise = undefined // allow another try
    throw e
  })
  return sdkPromise
}

let initialised = false

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      (v) => (clearTimeout(timer), resolve(v)),
      (e) => (clearTimeout(timer), reject(e)),
    )
  })
}

/** Asks Pi who the person is. Only the username scope is requested. */
export async function signInWithPi(): Promise<PiUser> {
  const sdk = await withTimeout(loadPiSdk(), SIGN_IN_TIMEOUT_MS)
  if (!initialised) {
    const ancestors = (window.location as Location & { ancestorOrigins?: DOMStringList }).ancestorOrigins
    sdk.init({ version: SDK_VERSION, sandbox: looksLikePiSandbox(ancestors ? [...ancestors] : undefined, document.referrer) })
    initialised = true
  }
  // No payments yet, so there is nothing to finish when Pi reports an unfinished one.
  const result = await withTimeout(sdk.authenticate(['username'], () => {}), SIGN_IN_TIMEOUT_MS)
  const user: PiUser = { uid: result.user.uid, username: result.user.username ?? '' }
  if (!user.username) throw new Error('no-username')
  storeUser(user)
  return user
}

export function signOutOfPi() {
  storeUser(undefined)
}
