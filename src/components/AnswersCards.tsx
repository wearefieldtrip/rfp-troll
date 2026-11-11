import { ExternalLinkIcon, LoaderCircleIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { DecisionButtons } from '@/components/DecisionCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { lineName, movedText, type AnswersResult, type OpenQuestion } from '@/lib/answers-view'
import type { Database } from '@/lib/database.types'
import { docUrl, fileUrl, formatDay } from '@/lib/questions-view'

type Rfp = Database['public']['Tables']['rfps']['Row']
type Answers = Database['public']['Tables']['rfp_answers']['Row']

export function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
      {children}
      <ExternalLinkIcon className="size-3" aria-hidden />
    </a>
  )
}

/** Links to everything the step has produced so far. */
function Links({ rfp, answers }: { rfp: Rfp; answers: Answers[] }) {
  const files = answers.filter((a) => a.drive_file_id)
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
      {files.map((a, i) => (
        <ExternalLink key={a.id} href={fileUrl(a.drive_file_id!)}>
          {files.length > 1 ? `Answers ${files.length - i} (${formatDay(a.received_on)})` : 'Answers'}
        </ExternalLink>
      ))}
      {rfp.questions_sent_pdf_id && <ExternalLink href={fileUrl(rfp.questions_sent_pdf_id)}>Questions as sent (PDF)</ExternalLink>}
      {rfp.questions_doc_id && <ExternalLink href={docUrl(rfp.questions_doc_id)}>Questions doc</ExternalLink>}
    </p>
  )
}

const sentLine = (rfp: Rfp) =>
  `${rfp.questions_sent_count ?? 0} question${rfp.questions_sent_count === 1 ? '' : 's'} sent${rfp.questions_sent_on ? ` on ${formatDay(rfp.questions_sent_on)}` : ''}.`

export function WaitingCard({ rfp, answers, onAdd, onDecideWithout }: { rfp: Rfp; answers: Answers[]; onAdd: () => void; onDecideWithout: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Waiting for answers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>{sentLine(rfp)}</p>
        <div className="flex flex-wrap items-center gap-4">
          <Button size="sm" onClick={onAdd}>
            Add answers
          </Button>
          <button type="button" onClick={onDecideWithout} className="text-muted-foreground underline underline-offset-4">
            Decide without answers
          </button>
        </div>
        <Links rfp={rfp} answers={answers} />
      </CardContent>
    </Card>
  )
}

export function ReadingCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reading the answers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
          Matching them to your questions, checking for changed facts and re-scoring the fit. This usually takes a minute or two.
        </p>
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </CardContent>
    </Card>
  )
}

export function FailedReadingCard({ error, retrying, onRetry }: { error: string | null; retrying: boolean; onRetry: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>The answers couldn't be read</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-destructive">{error ?? 'Reading them took too long.'}</p>
        <p className="text-muted-foreground">The answers are saved. Retrying uses AI credit again.</p>
        <Button size="sm" disabled={retrying} onClick={onRetry}>
          {retrying ? 'Starting…' : 'Retry'}
        </Button>
      </CardContent>
    </Card>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="font-medium">{title}</p>
      {children}
    </div>
  )
}

type AnswersInProps = {
  rfp: Rfp
  answers: Answers[]
  result: AnswersResult | null
  scoreText: string | null
  onAddMore: () => void
}

/** Answers are in: what changed, the new score beside the old one, and the decision. */
export function AnswersInCard({ rfp, answers, result, scoreText, onAddMore }: AnswersInProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Answers are in. Move to Proposal?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {result ? (
          <>
            <p>
              {result.previous_total !== result.total && (
                <span className="mr-2 text-muted-foreground line-through">
                  {result.previous_total} / 12 · {result.previous_band}
                </span>
              )}
              <span className="font-semibold">
                {result.total} / 12 · {result.band}
              </span>
              <span className="ml-2 text-muted-foreground">{movedText(result.moved)}</span>
            </p>

            {result.changes.length > 0 && (
              <Section title="Changed facts">
                <ul className="list-disc space-y-0.5 pl-5">
                  {result.changes.map((c) => (
                    <li key={c.label}>
                      {c.label} {c.to} <span className="text-muted-foreground">· updated from {c.from}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <Section title="What the answers changed">
              {result.what_changed.length > 0 ? (
                <ul className="list-disc space-y-0.5 pl-5">
                  {result.what_changed.map((w, i) => (
                    <li key={i}>
                      {w.text}
                      {w.answer > 0 && <span className="text-muted-foreground"> (answer {w.answer})</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">Nothing that changes the picture.</p>
              )}
            </Section>

            {result.unanswered.length > 0 && (
              <Section title="Not answered">
                <ul className="list-disc space-y-0.5 pl-5">
                  {result.unanswered.map((u, i) => (
                    <li key={i}>
                      {u.question}
                      {u.line && <span className="text-muted-foreground"> · {lineName(u.line)}</span>}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {result.other_agencies && (
              <Section title="What other agencies asked">
                <p>{result.other_agencies}</p>
              </Section>
            )}
          </>
        ) : (
          scoreText && <p className="font-semibold">{scoreText}</p>
        )}
        <DecisionButtons rfp={rfp} scoreText={scoreText} enabled proposalOnly />
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={onAddMore} className="text-muted-foreground underline underline-offset-4">
            Add more answers
          </button>
        </div>
        <Links rfp={rfp} answers={answers} />
        <p className="text-xs text-muted-foreground">AI reading. Check it against the answers document before you decide.</p>
      </CardContent>
    </Card>
  )
}

/** The decision without any answers: the score is from the RFP alone, with what is still open. */
export function NoAnswersCard({
  rfp,
  scoreText,
  open,
  onBack,
}: {
  rfp: Rfp
  scoreText: string | null
  open: OpenQuestion[]
  onBack: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No answers yet. Move to Proposal?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p>
          <span className="font-semibold">{scoreText}</span>
          <span className="ml-2 text-muted-foreground">Based on the RFP alone</span>
        </p>
        {open.length > 0 && (
          <Section title="Still unanswered">
            <ul className="list-disc space-y-0.5 pl-5">
              {open.map((q, i) => (
                <li key={i}>
                  {q.question}
                  {q.line && <span className="text-muted-foreground"> · {lineName(q.line)}</span>}
                </li>
              ))}
            </ul>
          </Section>
        )}
        <DecisionButtons rfp={rfp} scoreText={scoreText} enabled proposalOnly withoutAnswers />
        <button type="button" onClick={onBack} className="text-muted-foreground underline underline-offset-4">
          Back to waiting
        </button>
        <p className="text-xs text-muted-foreground">You can still add answers afterward.</p>
      </CardContent>
    </Card>
  )
}
