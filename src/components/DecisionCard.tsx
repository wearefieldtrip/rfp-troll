import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { invokeFunction } from '@/lib/functions'
import { supabase } from '@/lib/supabase'

/** `enabled` is false until a fit review has completed, so the decision is made with the review in hand. */
export function DecisionCard({ rfpId, enabled }: { rfpId: string; enabled: boolean }) {
  const queryClient = useQueryClient()
  const [passing, setPassing] = useState(false)
  const [reason, setReason] = useState('')

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['rfps'] })

  const moveForward = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('rfps').update({ status: 'questions' }).eq('id', rfpId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  // Passing also moves the Drive folder to _DEAD Opportunities, so it goes through the server.
  const pass = useMutation({
    mutationFn: () => invokeFunction('pass-rfp', { rfp_id: rfpId, reason: reason.trim() }),
    onSuccess: invalidate,
  })

  const busy = !enabled || moveForward.isPending || pass.isPending
  const error = moveForward.error ?? pass.error

  return (
    <Card aria-disabled={!enabled} className={enabled ? undefined : 'opacity-60'}>
      <CardHeader>
        <CardTitle>Decision</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {enabled ? 'The review is a recommendation. This is your call.' : 'Run a fit review first. Then decide whether to move forward or pass.'}
        </p>
        {passing ? (
          <div className="space-y-3">
            <Textarea
              aria-label="Reason for passing"
              placeholder="Why are we passing? (optional, but useful for future reviews)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The RFP and its review stay in the app under Passed. Its Drive folder moves to _DEAD Opportunities.
            </p>
            <div className="flex gap-3">
              <Button variant="destructive" disabled={busy} onClick={() => pass.mutate()}>
                {pass.isPending ? 'Passing…' : 'Confirm pass'}
              </Button>
              <Button variant="ghost" onClick={() => setPassing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <Button disabled={busy} onClick={() => moveForward.mutate()}>
              Move forward
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => setPassing(true)}>
              Pass
            </Button>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error.message}</p>}
      </CardContent>
    </Card>
  )
}
