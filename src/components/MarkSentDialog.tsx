import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { questionsDoc } from '@/lib/functions'
import { todayInputValue } from '@/lib/questions-view'

type Props = { rfpId: string; open: boolean; onOpenChange: (open: boolean) => void }

export function MarkSentDialog({ rfpId, open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const [sentOn, setSentOn] = useState(todayInputValue)

  const send = useMutation({
    mutationFn: () => questionsDoc(rfpId, 'send', { sentOn }),
    onSuccess: async () => {
      onOpenChange(false)
      await queryClient.invalidateQueries({ queryKey: ['rfps'] })
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (send.isPending) return
        onOpenChange(next)
        if (!next) {
          send.reset()
          setSentOn(todayInputValue())
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark the questions as sent?</DialogTitle>
          <DialogDescription>
            Accept or reject every suggestion in the doc first. A PDF of the doc as it stands is saved to the client's Drive folder.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <Label htmlFor="sent-on">Date sent</Label>
          <Input id="sent-on" type="date" value={sentOn} max={todayInputValue()} onChange={(e) => setSentOn(e.target.value)} disabled={send.isPending} />
          {send.error && <p className="text-destructive">{send.error.message}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={send.isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!sentOn || send.isPending} onClick={() => send.mutate()}>
            {send.isPending ? 'Saving the PDF…' : 'Mark as sent'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
