// Turns what the model returned into a checked review. The model supplies scores and words only;
// the totals, the maximum and the band are worked out here (docs/specs/step-1-evaluate.md, "Fit review output").
// An identical copy lives in supabase/functions/review-rfp/ (functions deploy independently).
import { bandFor, DIMENSION_KEYS, MAX_TOTAL, SCALE_MAX, type Band, type DimensionKey } from './rubric-structure.ts'

export const LIMITS = { evidencePerDimension: 2, risks: 3, questions: 8 }

export type Evidence = { quote: string; page: number | null }
export type ReviewDimension = { key: DimensionKey; score: number; reason: string; evidence: Evidence[] }

export type ReviewV2 = {
  version: 2
  verdict: string
  dimensions: ReviewDimension[]
  total: number
  max_total: number
  band: Band
  risks: string[]
  questions: string[]
  flags: string[]
  /** A one-sentence reason when the rubric's automatic no-go applies; empty otherwise. */
  auto_no_go: string
}

/** The model's output was unusable. The message says what was wrong. */
export class ReviewInvalid extends Error {}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
const textList = (value: unknown) => (Array.isArray(value) ? value.map(text).filter(Boolean) : [])

export function buildReview(raw: unknown, bands: Band[]): ReviewV2 {
  if (typeof raw !== 'object' || raw === null) throw new ReviewInvalid('The review was not in the expected format.')
  const r = raw as Record<string, unknown>

  const rawDimensions = Array.isArray(r.dimensions) ? r.dimensions : []
  const byKey = new Map<string, Record<string, unknown>>()
  for (const d of rawDimensions) {
    if (typeof d !== 'object' || d === null) continue
    const key = text((d as Record<string, unknown>).key)
    if (byKey.has(key)) throw new ReviewInvalid(`Dimension ${key} appeared more than once.`)
    byKey.set(key, d as Record<string, unknown>)
  }

  const dimensions: ReviewDimension[] = DIMENSION_KEYS.map((key) => {
    const d = byKey.get(key)
    if (!d) throw new ReviewInvalid(`Dimension ${key} was missing.`)
    const score = d.score
    if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > SCALE_MAX) {
      throw new ReviewInvalid(`Dimension ${key} had a score outside 0 to ${SCALE_MAX}.`)
    }
    const evidence: Evidence[] = (Array.isArray(d.evidence) ? d.evidence : [])
      .map((e): Evidence | null => {
        const quote = text((e as Record<string, unknown>)?.quote)
        const page = (e as Record<string, unknown>)?.page
        return quote ? { quote, page: typeof page === 'number' && Number.isInteger(page) && page > 0 ? page : null } : null
      })
      .filter((e): e is Evidence => e !== null)
      .slice(0, LIMITS.evidencePerDimension)
    return { key, score, reason: text(d.reason), evidence }
  })

  if (byKey.size > DIMENSION_KEYS.length) throw new ReviewInvalid('The review had dimensions that are not in the rubric.')

  const total = dimensions.reduce((sum, d) => sum + d.score, 0)
  const band = bandFor(total, bands)
  if (!band) throw new ReviewInvalid(`No decision band matches a total of ${total}.`)

  // The same question asked twice, however it is capitalized or punctuated, is shown once.
  const seen = new Set<string>()
  const questions = textList(r.questions).filter((q) => {
    const k = q.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  return {
    version: 2,
    verdict: text(r.verdict),
    dimensions,
    total,
    max_total: MAX_TOTAL,
    band,
    risks: textList(r.risks).slice(0, LIMITS.risks),
    questions: questions.slice(0, LIMITS.questions),
    flags: textList(r.flags),
    auto_no_go: text(r.auto_no_go),
  }
}
