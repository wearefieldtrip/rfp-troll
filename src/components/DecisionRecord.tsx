import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { rfpDecisionsQuery } from '@/lib/queries'
import { decisionScore, decisionWhat, decisionWhen, decisionWho } from '@/lib/decision-text'

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
          const score = decisionScore(d)
          return (
            <div key={d.id}>
              <p>
                <span className="font-medium">{decisionWhat(d)}</span>
                <span className="text-muted-foreground">
                  {' '}
                  · {decisionWho(d)} · {decisionWhen(d.decided_at)}
                  {score && ` · ${score}`}
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
