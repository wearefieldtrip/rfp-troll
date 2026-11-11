import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Database } from '@/lib/database.types'
import { OUTCOMES, outcomeStatus, STAGES } from '@/lib/review-imports'
import { supabase } from '@/lib/supabase'

type Rfp = Database['public']['Tables']['rfps']['Row']

const selectClass = 'h-9 w-full rounded-md border bg-transparent px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

function OutcomeForm({ rfp, onDone }: { rfp: Rfp; onDone: () => void }) {
  const queryClient = useQueryClient()
  const [outcome, setOutcome] = useState(rfp.outcome ?? 'unknown')
  const [stage, setStage] = useState(rfp.furthest_stage ?? '')
  const [reason, setReason] = useState(rfp.closed_reason ?? '')
  const [note, setNote] = useState(rfp.outcome_notes ?? '')

  const save = useMutation({
    mutationFn: async () => {
      // A hand edit counts as reviewing the RFP, so running the import again never overwrites it.
      const { error } = await supabase
        .from('rfps')
        .update({
          outcome,
          status: outcomeStatus(outcome),
          furthest_stage: stage || null,
          closed_reason: reason.trim() || null,
          outcome_notes: note.trim() || null,
          import_reviewed: true,
        })
        .eq('id', rfp.id)
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['rfps'] })
      onDone()
    },
  })

  return (
    <>
      <div className="space-y-4 text-sm">
        <div className="space-y-1.5">
          <Label htmlFor="outcome">Outcome</Label>
          <select id="outcome" className={selectClass} value={outcome} onChange={(e) => setOutcome(e.target.value)} disabled={save.isPending}>
            {OUTCOMES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stage">Furthest stage</Label>
          <select id="stage" className={selectClass} value={stage} onChange={(e) => setStage(e.target.value)} disabled={save.isPending}>
            {STAGES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reason">Reason</Label>
          <Input id="reason" value={reason} placeholder="For example Local agency" onChange={(e) => setReason(e.target.value)} disabled={save.isPending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="note">Note</Label>
          <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} disabled={save.isPending} />
        </div>
        {save.error && <p className="text-destructive">Could not save. Please try again.</p>}
      </div>
      <DialogFooter>
        <Button variant="outline" disabled={save.isPending} onClick={onDone}>
          Cancel
        </Button>
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </>
  )
}

/** Fixes how a past RFP turned out. Saving it marks the RFP reviewed. */
export function EditOutcomeDialog({ rfp, open, onOpenChange }: { rfp: Rfp; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit outcome</DialogTitle>
          <DialogDescription>Only a win is Closed · Won. Every other outcome is Closed · Lost. Saving marks this RFP reviewed.</DialogDescription>
        </DialogHeader>
        {open && <OutcomeForm rfp={rfp} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}
