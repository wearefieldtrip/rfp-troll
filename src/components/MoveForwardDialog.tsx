import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { destinationLabel, destinationStatus, moveForwardDestination } from '@/lib/decisions'
import { dayCountLabel, daysUntilMoment } from '@/lib/key-dates'
import { questionsDoc } from '@/lib/functions'
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

  const move = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('decide_rfp', {
        p_rfp_id: rfp.id,
        p_decision: 'move_forward',
        p_destination: choice.destination,
        p_note: withoutAnswers ? 'Decided without answers from the issuer.' : undefined,
        p_expected_status: rfp.status,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      // The doc is built in the background. If it can't start, the Questions card offers a retry.
      if (choice.destination === 'questions') void questionsDoc(rfp.id, 'build').catch(() => undefined)
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
            {choice.destination === 'questions' && (
              <>
                <li>Create a questions doc in the client's Drive folder from the template, keeping the template questions that fit this RFP</li>
                <li>Add the fit review's questions to it as suggestions for you to accept or reject</li>
              </>
            )}
          </ul>
          {!proposalOnly && choice.destination === 'questions' && deadline && (
            <p className="rounded-lg bg-muted px-3 py-2">
              Questions are due <b className="font-semibold">{formatMoment(deadline)}</b> ({dayCountLabel(daysUntilMoment(deadline))}).
            </p>
          )}
          {choice.why && <p className="rounded-lg bg-muted px-3 py-2">{choice.why}</p>}
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
