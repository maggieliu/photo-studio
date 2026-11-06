import { describe, expect, it } from 'vitest'
import { describePiError, looksLikePiSandbox, parseStoredUser } from './pi'

describe('looksLikePiSandbox', () => {
  it('recognizes the sandbox as the parent page', () => {
    expect(looksLikePiSandbox(['https://sandbox.minepi.com'], '')).toBe(true)
  })

  it('falls back to the referrer', () => {
    expect(looksLikePiSandbox(undefined, 'https://sandbox.minepi.com/mobile-app-ui/app/maggieapp')).toBe(true)
  })

  it('is false elsewhere, including look-alike hosts', () => {
    expect(looksLikePiSandbox(undefined, '')).toBe(false)
    expect(looksLikePiSandbox(['https://example.com'], 'https://minepi.com/')).toBe(false)
    expect(looksLikePiSandbox(['https://sandbox.minepi.com.evil.example'], 'https://evil.example/sandbox.minepi.com')).toBe(false)
  })
})

describe('parseStoredUser', () => {
  it('reads a saved user', () => {
    expect(parseStoredUser('{"uid":"u1","username":"maggie"}')).toEqual({ uid: 'u1', username: 'maggie' })
  })

  it('ignores missing, malformed or incomplete data', () => {
    expect(parseStoredUser(null)).toBeUndefined()
    expect(parseStoredUser('not json')).toBeUndefined()
    expect(parseStoredUser('{"uid":"u1"}')).toBeUndefined()
    expect(parseStoredUser('{"uid":"u1","username":""}')).toBeUndefined()
    expect(parseStoredUser('{"uid":1,"username":"x"}')).toBeUndefined()
  })

  it('drops extra fields, so nothing like a token can come back', () => {
    expect(parseStoredUser('{"uid":"u1","username":"m","accessToken":"secret"}')).toEqual({ uid: 'u1', username: 'm' })
  })
})

describe('describePiError', () => {
  it('points people to the Pi Browser when Pi does not answer', () => {
    expect(describePiError(new Error('timeout'))).toMatch(/Pi Browser/)
    expect(describePiError(new Error('sdk-load'))).toMatch(/Pi Browser/)
  })

  it('has a general message for anything else', () => {
    expect(describePiError(new Error('boom'))).toMatch(/Could not sign in/)
    expect(describePiError('weird')).toMatch(/Could not sign in/)
  })
})
