import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { describePiError, readStoredUser, signInWithPi, signOutOfPi } from './pi'

/** The optional Pi account: who is signed in, and how to sign in or out. */
export function usePiAccount() {
  const [user, setUser] = useState(readStoredUser)
  const [busy, setBusy] = useState(false)

  const signIn = useCallback(async () => {
    setBusy(true)
    try {
      const next = await signInWithPi()
      setUser(next)
      toast.success(`Signed in as @${next.username}`)
    } catch (e) {
      toast.error(describePiError(e))
    } finally {
      setBusy(false)
    }
  }, [])

  const signOut = useCallback(() => {
    signOutOfPi()
    setUser(undefined)
    toast('Signed out of Pi')
  }, [])

  return { user, busy, signIn, signOut }
}
