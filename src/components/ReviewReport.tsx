import { FitBadge } from '@/components/FitBadge'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fitTone, scoreTone, TONE_CLASSES } from '@/lib/fit-tone'
import type { ReviewView } from '@/lib/review-result'
import { cn } from '@/lib/utils'

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

export function ReviewReport({ view }: { view: ReviewView }) {
  const totalTone = fitTone(view.band, view.total, view.max)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn('text-3xl font-semibold', totalTone && TONE_CLASSES[totalTone].text)}>
          {view.total}
          <span className="text-lg text-muted-foreground"> / {view.max}</span>
        </span>
        {view.band && <FitBadge band={view.band} total={view.total} max={view.max} className="px-3 py-1 text-sm" />}
      </div>

      {view.flags.map((flag) => (
        <p key={flag} className="rounded-lg border px-3 py-2 text-sm">
          <span className="font-semibold">Check this:</span> {flag}
        </p>
      ))}
      {view.autoNoGo && <p className="text-sm text-destructive">{view.autoNoGo}</p>}
      {view.verdict && <p className="text-sm">{view.verdict}</p>}

      {view.facts.length > 0 && (
        <dl className="grid grid-cols-[7rem_1fr] gap-y-1 text-sm">
          {view.facts.map((f) => (
            <div key={f.label} className="contents">
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {view.dimensions.map((d) => (
        <Card key={d.id}>
          <CardHeader>
            <CardTitle>{d.title}</CardTitle>
            <CardAction>
              <Badge variant="outline" className={cn('px-2.5 py-0.5 text-sm font-semibold', TONE_CLASSES[scoreTone(d.score, d.max)].badge)}>
                {d.score} / {d.max}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{d.reason}</p>
            {d.evidence.map((e) => (
              <blockquote key={e.quote} className="border-l-2 pl-3 text-muted-foreground italic">
                {e.quote}
                {e.page != null && <span className="not-italic"> (p. {e.page})</span>}
              </blockquote>
            ))}
          </CardContent>
        </Card>
      ))}

      {view.risks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top risks</CardTitle>
          </CardHeader>
          <CardContent>
            <BulletList items={view.risks} />
          </CardContent>
        </Card>
      )}
      {view.notStated.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Not stated in the RFP</CardTitle>
          </CardHeader>
          <CardContent>
            <BulletList items={view.notStated} />
          </CardContent>
        </Card>
      )}
      {view.questions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Questions to ask</CardTitle>
          </CardHeader>
          <CardContent>
            <BulletList items={view.questions} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
