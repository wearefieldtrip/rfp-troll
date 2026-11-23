import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { proposalReview } from '@/lib/functions'
import { actionsFor, advanceCopy, ADVANCE, type AdvanceAction } from '@/lib/advance'
import { supabase } from '@/lib/supabase'

function ConfirmDialog({ rfpId, status, action, onClose }: { rfpId: string; status: string; action: AdvanceAction | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const info = action ? ADVANCE[action] : null

  const run = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('advance_rfp', { p_rfp_id: rfpId, p_action: action!, p_expected_status: status, p_note: note.trim() || undefined })
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      setNote('')
      // Ready for review starts the check. If it can't start, the Review card offers it.
      if (action === 'ready_for_review') void proposalReview(rfpId).catch(() => undefined)
      onClose()
      await queryClient.invalidateQueries({ queryKey: ['rfps'] })
    },
  })

  return (
    <Dialog
      open={action !== null}
      onOpenChange={(next) => {
        if (run.isPending) return
        if (!next) {
          run.reset()
          onClose()
        }
      }}
    >
      <DialogContent>
        {info && (
          <>
            <DialogHeader>
              <DialogTitle>{info.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <p>This will:</p>
              <ul className="list-disc space-y-1.5 pl-5">
                {info.will.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional)" aria-label="Note" rows={2} />
              {run.error && <p className="text-destructive">{run.error.message}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" disabled={run.isPending} onClick={onClose}>
                Cancel
              </Button>
              <Button disabled={run.isPending} onClick={() => run.mutate()}>
                {run.isPending ? 'Saving…' : info.button}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** The hand-offs open from the RFP's status: ready for review, submitted, shortlisted, won, lost. Each asks first. */
export function AdvanceCard({ rfpId, status }: { rfpId: string; status: string }) {
  const [action, setAction] = useState<AdvanceAction | null>(null)
  const copy = advanceCopy(status)
  const actions = actionsFor(status)
  if (!copy || actions.length === 0) return null

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">{copy.text}</p>
          <div className="flex flex-wrap gap-2">
            {actions.map((a, i) => (
              <Button key={a} size="sm" variant={i === 0 ? 'default' : 'outline'} onClick={() => setAction(a)}>
                {ADVANCE[a].button}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
      <ConfirmDialog rfpId={rfpId} status={status} action={action} onClose={() => setAction(null)} />
    </>
  )
}
