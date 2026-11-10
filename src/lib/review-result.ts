import type { ReviewV2 } from './fit-review.ts'
import { cleanBandLabel, DIMENSION_NAMES, SCALE_MAX } from './rubric-structure.ts'

/** What the report shows, whichever format the stored review is in. */
export type ReviewView = {
  total: number
  max: number
  band: string
  verdict: string
  dimensions: {
    id: string
    title: string
    score: number
    max: number
    reason: string
    evidence: { quote: string; page: number | null }[]
  }[]
  risks: string[]
  questions: string[]
  flags: string[]
  /** One sentence when the rubric's automatic no-go applies, otherwise empty. */
  autoNoGo: string
  /** Only reviews made before the fixed format carry these. */
  facts: { label: string; value: string }[]
  notStated: string[]
}

/** The first review format, before scores were fixed to 0 to 3 and the shape was trimmed. */
type ReviewV1 = {
  summary?: string
  extracted?: { budget?: string; project_timeline?: string; scope_summary?: string }
  dimensions?: { title: string; score: number; rationale?: string; evidence?: string[] }[]
  auto_no_go?: { triggered?: boolean; reason?: string }
  decision_band?: string
  risks?: string[]
  missing_information?: string[]
  suggested_questions?: string[]
}

export function toReviewView(result: unknown, totalScore: number | null, decisionBand: string | null): ReviewView {
  const r = (result ?? {}) as Record<string, unknown>

  if (r.version === 2) {
    const v = r as unknown as ReviewV2
    return {
      total: v.total,
      max: v.max_total,
      band: v.band.label,
      verdict: v.verdict,
      dimensions: v.dimensions.map((d) => ({
        id: d.key,
        title: `${d.key}. ${DIMENSION_NAMES[d.key]}`,
        score: d.score,
        max: SCALE_MAX,
        reason: d.reason,
        evidence: d.evidence,
      })),
      risks: v.risks,
      questions: v.questions,
      flags: v.flags,
      autoNoGo: v.auto_no_go,
      facts: [],
      notStated: [],
    }
  }

  // Older reviews let the model pick each dimension's maximum, so it could say "1 / 1" or "7 / 10".
  // The scale is fixed, so show it that way.
  const v = r as ReviewV1
  const dimensions = (v.dimensions ?? []).map((d, i) => ({
    id: String(i),
    title: d.title,
    score: d.score,
    max: SCALE_MAX,
    reason: d.rationale ?? '',
    evidence: (d.evidence ?? []).map((quote) => ({ quote, page: null })),
  }))
  const facts = [
    { label: 'Budget', value: v.extracted?.budget ?? '' },
    { label: 'Timeline', value: v.extracted?.project_timeline ?? '' },
    { label: 'Scope', value: v.extracted?.scope_summary ?? '' },
  ].filter((f) => f.value)

  return {
    total: totalScore ?? dimensions.reduce((sum, d) => sum + d.score, 0),
    max: dimensions.length * SCALE_MAX,
    band: cleanBandLabel(v.decision_band ?? decisionBand),
    verdict: v.summary ?? '',
    dimensions,
    risks: v.risks ?? [],
    questions: v.suggested_questions ?? [],
    flags: [],
    autoNoGo: v.auto_no_go?.triggered ? (v.auto_no_go.reason ?? '') : '',
    facts,
    notStated: v.missing_information ?? [],
  }
}
