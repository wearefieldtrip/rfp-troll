import { useState } from 'react'
import { MoveForwardDialog } from '@/components/MoveForwardDialog'
import { PassDialog } from '@/components/PassDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Database } from '@/lib/database.types'

type Rfp = Database['public']['Tables']['rfps']['Row']

/** Move forward and Pass. Both open a confirmation first; nothing happens until it is confirmed. */
export function DecisionCard({ rfp, scoreText, enabled }: { rfp: Rfp; scoreText: string | null; enabled: boolean }) {
  const [moving, setMoving] = useState(false)
  const [passing, setPassing] = useState(false)

  return (
    <Card aria-disabled={!enabled} className={enabled ? undefined : 'opacity-60'}>
      <CardHeader>
        <CardTitle>Decision</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {enabled ? 'The review is a recommendation. This is your call.' : 'Run a fit review first. Then decide whether to move forward or pass.'}
        </p>
        <div className="flex gap-3">
          <Button disabled={!enabled} onClick={() => setMoving(true)}>
            Move forward
          </Button>
          <Button variant="outline" disabled={!enabled} onClick={() => setPassing(true)}>
            Pass
          </Button>
        </div>
      </CardContent>
      <MoveForwardDialog rfp={rfp} scoreText={scoreText} open={moving} onOpenChange={setMoving} />
      <PassDialog rfpId={rfp.id} open={passing} onOpenChange={setPassing} />
    </Card>
  )
}
