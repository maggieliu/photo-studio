import { CircleUser, Loader2, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PiUser } from '@/pi'

type Props = {
  user?: PiUser
  busy: boolean
  onSignIn: () => void
  onSignOut: () => void
}

/** Optional Pi sign-in. Photo Studio works the same without it. */
export function PiAccount({ user, busy, onSignIn, onSignOut }: Props) {
  if (user) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-secondary/60 py-1 pr-1 pl-3">
        <CircleUser className="size-5 shrink-0 text-sidebar-accent-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">@{user.username}</span>
        <Button variant="ghost" size="sm" className="h-9" onClick={onSignOut}>
          Sign out
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-1">
      <Button variant="outline" className="h-11 w-full gap-2" onClick={onSignIn} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <LogIn />}
        {busy ? 'Waiting for Pi…' : 'Sign in with Pi'}
      </Button>
      <p className="text-center text-xs text-muted-foreground">Optional. Photo Studio works without it.</p>
    </div>
  )
}
