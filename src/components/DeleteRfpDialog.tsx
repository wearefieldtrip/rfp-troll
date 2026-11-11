import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { invokeFunction } from '@/lib/functions'

type Props = {
  rfp: { id: string; title: string; drive_folder_id: string | null }
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteRfpDialog({ rfp, open, onOpenChange: setOpen }: Props) {
  const [typed, setTyped] = useState('')
  const [trashFolder, setTrashFolder] = useState(false)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const hasFolder = !!rfp.drive_folder_id
  const confirmed = typed === rfp.title

  const remove = useMutation({
    mutationFn: () => invokeFunction('delete-rfp', { rfp_id: rfp.id, trash_drive_folder: hasFolder && trashFolder }),
    onSuccess: async () => {
      setOpen(false)
      navigate('/')
      await queryClient.invalidateQueries({ queryKey: ['rfps'] })
    },
  })

  const onOpenChange = (next: boolean) => {
    if (remove.isPending) return
    setOpen(next)
    if (!next) {
      setTyped('')
      setTrashFolder(false)
      remove.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this RFP?</DialogTitle>
          <DialogDescription className="break-words">
            <strong>{rfp.title}</strong>, its files and its fit reviews will be deleted from RFP Troll. This can't be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4 text-sm">
          {hasFolder && (
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={trashFolder} onChange={(e) => setTrashFolder(e.target.checked)} />
              <span>
                Also move its Drive files to the trash
                <span className="block text-muted-foreground">
                  If it's the client's only RFP, the whole client folder goes. Restorable from the trash for about 30 days.
                </span>
              </span>
            </label>
          )}

          <div className="space-y-2">
            <Label htmlFor="confirm-title" className="block break-words">
              Type <strong>{rfp.title}</strong> to confirm
            </Label>
            <Input
              id="confirm-title"
              value={typed}
              autoComplete="off"
              onChange={(e) => setTyped(e.target.value)}
              disabled={remove.isPending}
            />
          </div>

          {remove.error && <p className="text-destructive">{remove.error.message}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={remove.isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={!confirmed || remove.isPending} onClick={() => remove.mutate()}>
            {remove.isPending ? 'Deleting…' : 'Delete RFP'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
