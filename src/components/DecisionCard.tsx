import { useState } from 'react'
import { MoveForwardDialog } from '@/components/MoveForwardDialog'
import { PassDialog } from '@/components/PassDialog'
import { Button } from '@/components/ui/button'
import type { Database } from '@/lib/database.types'

type Rfp = Database['public']['Tables']['rfps']['Row']

/** Move forward and Pass, for the fit card. Both open a confirmation first; nothing happens until it is confirmed. */
type Props = { rfp: Rfp; scoreText: string | null; enabled: boolean; proposalOnly?: boolean; withoutAnswers?: boolean }

export function DecisionButtons({ rfp, scoreText, enabled, proposalOnly = false, withoutAnswers = false }: Props) {
  const [moving, setMoving] = useState(false)
  const [passing, setPassing] = useState(false)

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        <Button disabled={!enabled} onClick={() => setMoving(true)}>
          {proposalOnly ? 'Move to Proposal' : 'Move forward'}
        </Button>
        <Button variant="outline" disabled={!enabled} onClick={() => setPassing(true)}>
          Pass
        </Button>
      </div>
      {!enabled && <p className="text-sm text-muted-foreground">Run a fit review first. Then decide whether to move forward or pass.</p>}
      <MoveForwardDialog rfp={rfp} scoreText={scoreText} open={moving} onOpenChange={setMoving} proposalOnly={proposalOnly} withoutAnswers={withoutAnswers} />
      <PassDialog rfpId={rfp.id} open={passing} onOpenChange={setPassing} />
    </div>
  )
}
