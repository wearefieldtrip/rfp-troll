import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'

export function DecisionCard({ rfpId }: { rfpId: string }) {
  const queryClient = useQueryClient()
  const [passing, setPassing] = useState(false)
  const [reason, setReason] = useState('')

  const decide = useMutation({
    mutationFn: async (update: { status: 'questions' } | { status: 'passed'; passed_from_status: 'evaluating'; outcome_notes: string | null }) => {
      const { error } = await supabase.from('rfps').update(update).eq('id', rfpId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rfps'] }),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Decision</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">The review is a recommendation. This is your call.</p>
        {passing ? (
          <div className="space-y-3">
            <Textarea
              aria-label="Reason for passing"
              placeholder="Why are we passing? (optional, but useful for future reviews)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex gap-3">
              <Button
                variant="destructive"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ status: 'passed', passed_from_status: 'evaluating', outcome_notes: reason.trim() || null })}
              >
                Confirm pass
              </Button>
              <Button variant="ghost" onClick={() => setPassing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <Button disabled={decide.isPending} onClick={() => decide.mutate({ status: 'questions' })}>
              Move forward
            </Button>
            <Button variant="outline" onClick={() => setPassing(true)}>
              Pass
            </Button>
          </div>
        )}
        {decide.error && <p className="text-sm text-destructive">Could not save your decision. Please try again.</p>}
      </CardContent>
    </Card>
  )
}
