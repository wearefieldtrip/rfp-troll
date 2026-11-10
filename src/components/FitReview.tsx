import { ChevronDownIcon, CircleAlertIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { FitBadge } from '@/components/FitBadge'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fitTone, scoreTone, TONE_CLASSES } from '@/lib/fit-tone'
import type { ReviewView } from '@/lib/review-result'
import { cn } from '@/lib/utils'

const QUESTIONS_SHOWN = 5

/** "Check this" notes: only real problems with the document, so they only appear when the review found one. */
export function CheckThis({ flags }: { flags: string[] }) {
  return (
    <>
      {flags.map((flag) => (
        <div key={flag} role="note" className="flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm">
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="font-semibold">Check this:</span> {flag}
          </span>
        </div>
      ))}
    </>
  )
}

/** The score, the verdict and the four rubric rows. Clicking a row shows its quotes from the RFP. */
export function FitCard({ view, footer }: { view: ReviewView; footer: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const totalTone = fitTone(view.band, view.total, view.max)

  return (
    <Card aria-label="Fit review">
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className={cn('text-4xl font-medium tracking-tight', totalTone && TONE_CLASSES[totalTone].text)}>
              {view.total}
              <span className="text-xl text-muted-foreground"> / {view.max}</span>
            </span>
            {view.band && <FitBadge band={view.band} total={view.total} max={view.max} className="px-3 py-1 text-sm" />}
          </div>
          {view.verdict && <p className="max-w-prose">{view.verdict}</p>}
          {view.autoNoGo && <p className="text-sm text-destructive">{view.autoNoGo}</p>}
          {view.facts.length > 0 && (
            <dl className="grid grid-cols-[6rem_1fr] gap-y-1 pt-1 text-sm">
              {view.facts.map((f) => (
                <div key={f.label} className="contents">
                  <dt className="text-muted-foreground">{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div>
          {view.dimensions.map((d) => {
            const open = openId === d.id
            const hasEvidence = d.evidence.length > 0
            return (
              <div key={d.id} className="border-t">
                <button
                  type="button"
                  disabled={!hasEvidence}
                  aria-expanded={hasEvidence ? open : undefined}
                  onClick={() => setOpenId(open ? null : d.id)}
                  className={cn(
                    'grid w-full gap-x-4 gap-y-1 py-3.5 text-left text-sm md:grid-cols-[14rem_4.5rem_1fr_1.25rem]',
                    hasEvidence ? 'cursor-pointer hover:bg-muted/40' : 'cursor-default',
                  )}
                >
                  <span className="font-medium">{d.title}</span>
                  <span>
                    <Badge variant="outline" className={cn('px-2.5 py-0.5 font-semibold', TONE_CLASSES[scoreTone(d.score, d.max)].badge)}>
                      {d.score}/{d.max}
                    </Badge>
                  </span>
                  <span className="text-muted-foreground">{d.reason}</span>
                  {hasEvidence ? (
                    <ChevronDownIcon className={cn('mt-0.5 size-4 transition-transform', open && 'rotate-180')} aria-hidden />
                  ) : (
                    <span />
                  )}
                </button>
                {open && (
                  <div className="space-y-2 pb-3.5 md:pl-[20.5rem]">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">From the RFP</p>
                    {d.evidence.map((e) => (
                      <blockquote key={e.quote} className="border-l-2 pl-3 text-sm text-muted-foreground italic">
                        {e.quote}
                        {e.page != null && <span className="not-italic"> (p. {e.page})</span>}
                      </blockquote>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-xs text-muted-foreground">{footer}</p>
      </CardContent>
    </Card>
  )
}

export function RisksCard({ risks, notStated }: { risks: string[]; notStated: string[] }) {
  if (risks.length === 0 && notStated.length === 0) return null
  return (
    <>
      {risks.length > 0 && (
        <Card aria-label="Top risks">
          <CardHeader>
            <CardTitle>Top risks</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-2 pl-5">
              {risks.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
      {notStated.length > 0 && (
        <Card aria-label="Not stated in the RFP">
          <CardHeader>
            <CardTitle>Not stated in the RFP</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5">
              {notStated.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  )
}

export function QuestionsCard({ questions }: { questions: string[] }) {
  const [all, setAll] = useState(false)
  if (questions.length === 0) return null
  const shown = all ? questions : questions.slice(0, QUESTIONS_SHOWN)

  return (
    <Card aria-label="Questions to ask">
      <CardHeader>
        <CardTitle>Questions to ask</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ol className="list-decimal space-y-2 pl-5">
          {shown.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
        {questions.length > QUESTIONS_SHOWN && (
          <button type="button" onClick={() => setAll(!all)} className="text-sm underline underline-offset-4">
            {all ? 'Show fewer' : `Show all ${questions.length}`}
          </button>
        )}
      </CardContent>
    </Card>
  )
}
