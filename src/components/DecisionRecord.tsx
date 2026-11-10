import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { rfpDecisionsQuery } from '@/lib/queries'
import { cleanBandLabel, MAX_TOTAL } from '@/lib/rubric-structure'
import { statusLabel } from '@/lib/rfp-status'

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/** Who decided what, when, and what the score was at that moment. */
export function DecisionRecord({ rfpId }: { rfpId: string }) {
  const { data } = useQuery(rfpDecisionsQuery(rfpId))
  if (!data || data.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Decisions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {data.map((d) => {
          const who = d.profiles?.full_name ?? d.profiles?.email ?? 'Someone'
          const score = d.score_total != null ? ` · ${d.score_total} / ${MAX_TOTAL} ${cleanBandLabel(d.score_band)}`.trimEnd() : ''
          const what =
            d.kind === 'pass'
              ? `Passed (${d.reason})`
              : d.kind === 'reopen'
                ? `Reopened to ${statusLabel(d.to_status)}`
                : `Moved forward to ${statusLabel(d.to_status)}`
          return (
            <div key={d.id}>
              <p>
                <span className="font-medium">{what}</span>
                <span className="text-muted-foreground">
                  {' '}
                  · {who} · {when(d.decided_at)}
                  {score}
                </span>
              </p>
              {d.note && <p className="text-muted-foreground italic">{d.note}</p>}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
