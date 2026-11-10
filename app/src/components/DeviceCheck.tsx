import type { CapabilityResult } from '@/capabilities'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

/** Shows which browser features the app needs and whether this device has them. */
export function DeviceCheck({ capabilities }: { capabilities: CapabilityResult[] }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="link" size="xs" className="h-auto min-h-11 px-2 text-xs text-muted-foreground">
          Device check
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Device check</DialogTitle>
          <DialogDescription>Features this app needs from your browser.</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-2 text-sm">
          {capabilities.map((c) => (
            <li key={c.key} className="flex items-center justify-between gap-4 border-b py-2 last:border-0">
              <span>{c.label}</span>
              <span className={c.supported ? 'text-accent-foreground' : 'text-destructive'}>
                {c.supported ? 'Supported' : 'Missing'}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs break-all text-muted-foreground">{navigator.userAgent}</p>
      </DialogContent>
    </Dialog>
  )
}
