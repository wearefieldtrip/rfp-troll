// The history list for one RFP, put together from rows that already record who and when.
// Marking the questions as sent has only a day, no person; owner changes and file replacements are not recorded yet.
import { decisionScore, decisionWhat, decisionWho, type DecisionRow } from './decision-text.ts'
import { cleanBandLabel, MAX_TOTAL } from './rubric-structure.ts'

export type HistoryEntry = {
  id: string
  /** ISO time. For a day-only entry it is noon UTC of that day. */
  at: string
  dateOnly?: boolean
  title: string
  detail?: string
  note?: string | null
  who: string | null
}

type Person = { id: string; full_name: string | null; email: string }

export type HistoryInput = {
  rfp: { created_at: string; created_by: string | null; questions_sent_on: string | null; questions_sent_count: number | null }
  reviews: { id: string; status: string; created_at: string; completed_at: string | null; created_by: string | null; total_score: number | null; decision_band: string | null }[]
  decisions: (DecisionRow & { id: string; note: string | null })[]
  answers: { id: string; created_at: string; created_by: string | null; received_on: string; status: string; review_id: string | null; file_name: string | null }[]
  people: Person[]
}

const day = (value: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', dateStyle: 'medium' }).format(new Date(`${value}T12:00:00Z`))
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Newest first. */
export function buildHistory({ rfp, reviews, decisions, answers, people }: HistoryInput): HistoryEntry[] {
  const nameOf = (id: string | null) => {
    const person = id ? people.find((p) => p.id === id) : null
    return person ? (person.full_name ?? person.email) : null
  }
  // A review made from a batch of answers is the re-score, not a fit review someone ran.
  const rescored = new Set(answers.map((a) => a.review_id).filter((id): id is string => !!id))

  const entries: HistoryEntry[] = [{ id: 'added', at: rfp.created_at, title: 'RFP added', who: nameOf(rfp.created_by) }]

  for (const r of reviews) {
    if (r.status !== 'complete') continue
    entries.push({
      id: `review-${r.id}`,
      at: r.completed_at ?? r.created_at,
      title: rescored.has(r.id) ? 'Re-scored after answers' : 'Fit review run',
      detail: r.total_score != null ? `${r.total_score} / ${MAX_TOTAL} ${cleanBandLabel(r.decision_band)}`.trimEnd() : undefined,
      who: nameOf(r.created_by),
    })
  }

  for (const d of decisions) {
    entries.push({ id: `decision-${d.id}`, at: d.decided_at, title: decisionWhat(d), detail: decisionScore(d) || undefined, note: d.note, who: decisionWho(d) })
  }

  for (const a of answers) {
    entries.push({
      id: `answers-${a.id}`,
      at: a.created_at,
      title: a.status === 'failed' ? 'Answers added, reading failed' : 'Answers added',
      detail: `Received ${day(a.received_on)}`,
      who: nameOf(a.created_by),
    })
  }

  if (rfp.questions_sent_on) {
    entries.push({
      id: 'sent',
      at: `${rfp.questions_sent_on}T12:00:00Z`,
      dateOnly: true,
      title: 'Questions marked as sent',
      detail: rfp.questions_sent_count != null ? plural(rfp.questions_sent_count, 'question') : undefined,
      who: null,
    })
  }

  return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}
