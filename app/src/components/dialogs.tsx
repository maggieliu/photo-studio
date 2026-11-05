import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

type NameDialogProps = {
  open: boolean
  title: string
  initial?: string
  submitLabel: string
  onSubmit: (name: string) => void
  onClose: () => void
}

// The form is mounted only while the dialog is open, so it starts fresh every time.
function NameForm({ initial = '', submitLabel, onSubmit, onClose }: Omit<NameDialogProps, 'open' | 'title'>) {
  const [name, setName] = useState(initial)
  const valid = name.trim() !== ''
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSubmit(name.trim())
      }}
    >
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Album name"
        aria-label="Album name"
        maxLength={80}
        // 16px stops iOS from zooming in when the field gets focus.
        className="h-10 text-base"
      />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Asks for a name, for creating or renaming an album. */
export function NameDialog({ open, title, ...form }: NameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && form.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <NameForm {...form} />
      </DialogContent>
    </Dialog>
  )
}

type ConfirmDialogProps = {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
}

/** A yes/no question for actions that cannot be undone. */
export function ConfirmDialog({ open, title, description, confirmLabel, onConfirm, onClose }: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
