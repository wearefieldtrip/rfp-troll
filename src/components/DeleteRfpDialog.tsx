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
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { invokeFunction } from '@/lib/functions'

type Props = {
  rfp: { id: string; title: string; drive_folder_id: string | null }
  documentCount: number
  reviewCount: number
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function DeleteRfpDialog({ rfp, documentCount, reviewCount }: Props) {
  const [open, setOpen] = useState(false)
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
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>Delete RFP</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this RFP?</DialogTitle>
          <DialogDescription>
            This permanently deletes <strong>{rfp.title}</strong> from RFP Troll. This can't be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div>
            <p className="font-medium">This will delete:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
              <li>The RFP and its details</li>
              <li>{plural(documentCount, 'uploaded RFP file')} (the app's record of it)</li>
              <li>{plural(reviewCount, 'fit review')} and their scores</li>
            </ul>
          </div>

          {hasFolder && (
            <fieldset className="space-y-2">
              <legend className="font-medium">What should happen to the Drive folder?</legend>
              <label className="flex items-start gap-2">
                <input type="radio" name="drive-folder" className="mt-1" checked={!trashFolder} onChange={() => setTrashFolder(false)} />
                <span>
                  <span className="font-medium">Keep the folder</span>
                  <span className="block text-muted-foreground">
                    The folder and everything in it stay in Drive. Nothing in the app will link to it anymore.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input type="radio" name="drive-folder" className="mt-1" checked={trashFolder} onChange={() => setTrashFolder(true)} />
                <span>
                  <span className="font-medium">Move to the Drive trash</span>
                  <span className="block text-muted-foreground">
                    If this is the client's only RFP, the whole folder goes to the trash, including your team's own work. If the
                    client has other RFPs here, only this RFP's files do. Either can be restored from the shared drive's trash
                    for about 30 days.
                  </span>
                </span>
              </label>
            </fieldset>
          )}

          <div className="space-y-2">
            <Label htmlFor="confirm-title">
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
