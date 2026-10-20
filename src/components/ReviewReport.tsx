import { FitBadge } from '@/components/FitBadge'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fitTone, scoreTone, TONE_CLASSES } from '@/lib/fit-tone'
import { cn } from '@/lib/utils'
import type { ReviewResult } from '@/lib/review-result'

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

export function ReviewReport({ result, totalScore }: { result: ReviewResult; totalScore: number }) {
  // Client and proposal due date already appear in the Details card.
  const totalTone = fitTone(result.decision_band, totalScore, result.max_total)

  const extracted = Object.entries({
    Budget: result.extracted.budget,
    Timeline: result.extracted.project_timeline,
    Scope: result.extracted.scope_summary,
  }).filter(([, value]) => value)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn('text-3xl font-semibold', totalTone && TONE_CLASSES[totalTone].text)}>
          {totalScore}
          <span className="text-lg text-muted-foreground"> / {result.max_total}</span>
        </span>
        {result.decision_band && (
          <FitBadge band={result.decision_band} total={totalScore} max={result.max_total} className="px-3 py-1 text-sm" />
        )}
      </div>

      {result.auto_no_go.triggered && <p className="text-sm text-destructive">{result.auto_no_go.reason}</p>}
      <p className="text-sm">{result.summary}</p>

      {extracted.length > 0 && (
        <dl className="grid grid-cols-[7rem_1fr] gap-y-1 text-sm">
          {extracted.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {result.dimensions.map((d) => (
        <Card key={d.title}>
          <CardHeader>
            <CardTitle>{d.title}</CardTitle>
            <CardAction>
              <Badge variant="outline" className={cn('px-2.5 py-0.5 text-sm font-semibold', TONE_CLASSES[scoreTone(d.score, d.max_score)].badge)}>
                {d.score} / {d.max_score}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{d.rationale}</p>
            {d.evidence.map((quote) => (
              <blockquote key={quote} className="border-l-2 pl-3 text-muted-foreground italic">
                {quote}
              </blockquote>
            ))}
          </CardContent>
        </Card>
      ))}

      {result.risks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Risks</CardTitle>
          </CardHeader>
          <CardContent>
            <BulletList items={result.risks} />
          </CardContent>
        </Card>
      )}
      {result.missing_information.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Not stated in the RFP</CardTitle>
          </CardHeader>
          <CardContent>
            <BulletList items={result.missing_information} />
          </CardContent>
        </Card>
      )}
      {result.suggested_questions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Suggested questions to ask</CardTitle>
          </CardHeader>
          <CardContent>
            <BulletList items={result.suggested_questions} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
