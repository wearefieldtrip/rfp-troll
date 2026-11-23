import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { BaseProposalPicker } from '@/components/BaseProposalPicker'
import { chosenBaseId, useBaseCandidates } from '@/lib/base-candidates'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { destinationLabel, destinationStatus, moveForwardDestination } from '@/lib/decisions'
import { dayCountLabel, daysUntilMoment } from '@/lib/key-dates'
import { buildRequirements, proposalDoc, questionsDoc } from '@/lib/functions'
import { momentFrom } from '@/lib/moment-columns'
import { formatMoment } from '@/lib/rfp-dates'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type Rfp = Database['public']['Tables']['rfps']['Row']

type Props = {
  rfp: Rfp
  scoreText: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** From Questions the only way forward is Proposal. */
  proposalOnly?: boolean
  /** The decision is made before any answers arrived; the record says so. */
  withoutAnswers?: boolean
}

export function MoveForwardDialog({ rfp, scoreText, open, onOpenChange, proposalOnly = false, withoutAnswers = false }: Props) {
  const queryClient = useQueryClient()
  const deadline = rfp.questions_policy === 'due' ? momentFrom(rfp, 'questions_due') : null
  const choice = proposalOnly ? { destination: 'proposal' as const, why: '' } : moveForwardDestination({ policy: rfp.questions_policy, deadline })
  const label = destinationLabel(choice.destination)
  const proposalDue = momentFrom(rfp, 'proposal_due')

  // Only a move to Proposal builds from a past proposal. The best match is chosen unless another is picked.
  const [pickedBase, setPickedBase] = useState<string | null>(null)
  const candidates = useBaseCandidates(rfp.id, new Date(rfp.created_at).getFullYear())
  const baseId = choice.destination === 'proposal' ? chosenBaseId(candidates.ranked, pickedBase) : null
  const base = candidates.ranked.find((m) => m.item.id === baseId)

  const move = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('decide_rfp', {
        p_rfp_id: rfp.id,
        p_decision: 'move_forward',
        p_destination: choice.destination,
        p_note: [withoutAnswers && 'Decided without answers from the issuer.', base && `Proposal based on ${base.item.client_name ?? base.item.title} (${base.year}).`].filter(Boolean).join(' ') || undefined,
        p_expected_status: rfp.status,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      // The doc is built in the background. If it can't start, the Questions card offers a retry.
      if (choice.destination === 'questions') void questionsDoc(rfp.id, 'build').catch(() => undefined)
      // The proposal doc waits for the requirements itself. Without a base, the Proposal section offers to pick one.
      if (choice.destination === 'proposal') {
        void buildRequirements(rfp.id).catch(() => undefined)
        if (baseId) void proposalDoc(rfp.id, baseId).catch(() => undefined)
      }
      onOpenChange(false)
      await queryClient.invalidateQueries({ queryKey: ['rfps'] })
    },
  })

  return (
    <Dialog open={open} onOpenChange={(next) => !move.isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to {label}?</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p>This will:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Change the status to {destinationStatus(choice.destination)}</li>
            <li>Record this decision{scoreText ? ` with the current score (${scoreText})` : ''}</li>
            {withoutAnswers && <li>Note on the record that this was decided without answers</li>}
            {choice.destination === 'proposal' && (
              <>
                <li>Read what the RFP asks the proposal to contain, including any addenda and answers</li>
                <li>Create a proposal Doc in the client's Drive folder as a copy of a past proposal, matched to those sections</li>
                <li>Comment on each section with where it came from and what to check. It's a first draft: the team writes the rest</li>
              </>
            )}
            {choice.destination === 'questions' && (
              <>
                <li>Create a questions doc in the client's Drive folder from the template, keeping the template questions that fit this RFP</li>
                <li>Add the fit review's questions to it as suggestions for you to accept or reject</li>
              </>
            )}
          </ul>
          {!proposalOnly && choice.destination === 'questions' && deadline && (
            <p className="rounded-lg bg-muted/60 px-4 py-3">
              Questions are due <b className="font-semibold">{formatMoment(deadline)}</b> ({dayCountLabel(daysUntilMoment(deadline))}).
            </p>
          )}
          {choice.destination === 'proposal' && (
            <BaseProposalPicker rfpId={rfp.id} year={new Date(rfp.created_at).getFullYear()} value={pickedBase} onChange={setPickedBase} />
          )}
          {choice.destination === 'proposal' && proposalDue && (
            <p className="rounded-lg bg-muted/60 px-4 py-3">
              The proposal is due <b className="font-semibold">{formatMoment(proposalDue)}</b> ({dayCountLabel(daysUntilMoment(proposalDue))}).
            </p>
          )}
          {choice.why && <p className="rounded-lg bg-muted/60 px-4 py-3">{choice.why}</p>}
          {move.error && <p className="text-destructive">{move.error.message}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={move.isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={move.isPending} onClick={() => move.mutate()}>
            {move.isPending ? 'Moving…' : `Move to ${label}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
