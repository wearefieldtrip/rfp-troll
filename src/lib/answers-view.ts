// What the answers step shows, worked out from the stored rows. Pure, so it is tested.
import { DIMENSION_KEYS, DIMENSION_NAMES, type DimensionKey } from './rubric-structure.ts'

export type AnswersResult = {
  what_changed: { text: string; answer: number }[]
  unanswered: { question: string; line: DimensionKey | null }[]
  other_agencies: string
  moved: { key: DimensionKey; from: number; to: number }[]
  previous_total: number
  previous_band: string
  total: number
  band: string
  changes: { label: string; from: string; to: string }[]
}

const isKey = (value: unknown): value is DimensionKey => typeof value === 'string' && (DIMENSION_KEYS as readonly string[]).includes(value)
const list = (value: unknown) => (Array.isArray(value) ? value : [])
const text = (value: unknown) => (typeof value === 'string' ? value : '')
const num = (value: unknown) => (typeof value === 'number' ? value : 0)

/** Reads a stored result defensively: a row from a failed or older run must never crash the page. */
export function toAnswersResult(value: unknown): AnswersResult | null {
  if (typeof value !== 'object' || value === null) return null
  const r = value as Record<string, unknown>
  return {
    what_changed: list(r.what_changed).map((w) => ({ text: text((w as Record<string, unknown>)?.text), answer: num((w as Record<string, unknown>)?.answer) })).filter((w) => w.text),
    unanswered: list(r.unanswered)
      .map((u) => ({ question: text((u as Record<string, unknown>)?.question), line: isKey((u as Record<string, unknown>)?.line) ? ((u as Record<string, unknown>).line as DimensionKey) : null }))
      .filter((u) => u.question),
    other_agencies: text(r.other_agencies),
    moved: list(r.moved)
      .filter((m) => isKey((m as Record<string, unknown>)?.key))
      .map((m) => ({ key: (m as Record<string, unknown>).key as DimensionKey, from: num((m as Record<string, unknown>).from), to: num((m as Record<string, unknown>).to) })),
    previous_total: num(r.previous_total),
    previous_band: text(r.previous_band),
    total: num(r.total),
    band: text(r.band),
    changes: list(r.changes)
      .map((c) => ({ label: text((c as Record<string, unknown>)?.label), from: text((c as Record<string, unknown>)?.from), to: text((c as Record<string, unknown>)?.to) }))
      .filter((c) => c.label),
  }
}

export const lineName = (key: DimensionKey) => `${key}. ${DIMENSION_NAMES[key]}`

/** "Budget and value moved from 1 to 2" for each line that moved. */
export function movedText(moved: AnswersResult['moved']): string {
  if (moved.length === 0) return 'No rubric line moved.'
  return moved.map((m) => `${DIMENSION_NAMES[m.key]} moved from ${m.from} to ${m.to}`).join('; ') + '.'
}

export type OpenQuestion = { question: string; line: DimensionKey | null }

/**
 * The open questions that matter most to the score: those tied to the rubric line with the lowest score first,
 * then the ones with no line. Works from the fit review's own questions, so it needs no new AI call.
 */
export function stillUnanswered(review: unknown, limit = 3): OpenQuestion[] {
  const r = (review ?? {}) as Record<string, unknown>
  if (r.version !== 2) return []
  const questions = list(r.questions).filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
  const lines = list(r.question_lines)
  const scores = new Map<string, number>(list(r.dimensions).map((d) => [text((d as Record<string, unknown>)?.key), num((d as Record<string, unknown>)?.score)]))

  return questions
    .map((question, i) => ({ question, line: isKey(lines[i]) ? (lines[i] as DimensionKey) : null, order: i }))
    .sort((a, b) => {
      const sa = a.line ? (scores.get(a.line) ?? 4) : 4
      const sb = b.line ? (scores.get(b.line) ?? 4) : 4
      return sa - sb || a.order - b.order
    })
    .slice(0, limit)
    .map(({ question, line }) => ({ question, line }))
}

/** A batch still "reading" long after it started has been lost; treat it as failed so it can be retried. */
export const READING_TIMEOUT_MS = 15 * 60 * 1000

export function answersState(row: { status: string; created_at: string }, now: Date = new Date()): 'reading' | 'done' | 'failed' {
  if (row.status === 'done') return 'done'
  if (row.status === 'failed') return 'failed'
  return now.getTime() - new Date(row.created_at).getTime() > READING_TIMEOUT_MS ? 'failed' : 'reading'
}
