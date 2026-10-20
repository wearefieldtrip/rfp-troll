import type { Rubric } from './queries'

export type BandTone = 'go' | 'conditional' | 'likely_no' | 'no'

export const BAND_TONES: { value: BandTone; label: string }[] = [
  { value: 'go', label: 'Go' },
  { value: 'conditional', label: 'Conditional' },
  { value: 'likely_no', label: 'Likely no-go' },
  { value: 'no', label: 'No-go' },
]

export type DraftLevel = { score: number; label: string; description: string; is_auto_no_go: boolean }
export type DraftDimension = { key: string; title: string; levels: DraftLevel[] }
export type DraftBand = {
  key: string
  min_score: number
  max_score: number
  label: string
  action: string
  tone: BandTone
}
export type RubricDraft = { scaleMax: number; dimensions: DraftDimension[]; bands: DraftBand[] }

export const toDraft = (rubric: Rubric): RubricDraft => ({
  scaleMax: rubric.scale_max,
  dimensions: rubric.rubric_dimensions.map((d) => ({
    key: d.id,
    title: d.title,
    levels: d.rubric_levels.map(({ score, label, description, is_auto_no_go }) => ({
      score,
      label,
      description,
      is_auto_no_go,
    })),
  })),
  bands: rubric.rubric_decision_bands.map((b) => ({
    key: b.id,
    min_score: b.min_score,
    max_score: b.max_score,
    label: b.label,
    action: b.action,
    tone: b.tone as BandTone,
  })),
})

export const newDimension = (scaleMax: number): DraftDimension => ({
  key: crypto.randomUUID(),
  title: '',
  levels: Array.from({ length: scaleMax + 1 }, (_, i) => ({
    score: scaleMax - i,
    label: '',
    description: '',
    is_auto_no_go: false,
  })),
})

export const newBand = (): DraftBand => ({
  key: crypto.randomUUID(),
  min_score: 0,
  max_score: 0,
  label: '',
  action: '',
  tone: 'conditional',
})

export const maxTotal = (draft: RubricDraft) => draft.dimensions.length * draft.scaleMax

/** Returns human-readable problems; an empty list means the draft can be saved. */
export function validateDraft(draft: RubricDraft): string[] {
  const problems: string[] = []
  if (draft.dimensions.length === 0) problems.push('Add at least one dimension.')
  if (draft.dimensions.some((d) => !d.title.trim())) problems.push('Every dimension needs a title.')
  if (draft.dimensions.some((d) => d.levels.some((l) => !l.label.trim() || !l.description.trim())))
    problems.push('Every score level needs a label and a description.')

  if (draft.bands.length === 0) {
    problems.push('Add at least one decision band.')
  } else {
    if (draft.bands.some((b) => !b.label.trim() || !b.action.trim()))
      problems.push('Every decision band needs a label and an action.')
    const sorted = [...draft.bands].sort((a, b) => a.min_score - b.min_score)
    const total = maxTotal(draft)
    const covered =
      sorted[0].min_score === 0 &&
      sorted[sorted.length - 1].max_score === total &&
      sorted.every((b, i) => b.min_score <= b.max_score && (i === 0 || b.min_score === sorted[i - 1].max_score + 1))
    if (!covered) problems.push(`Decision bands must cover every total from 0 to ${total} with no gaps or overlaps.`)
  }
  return problems
}

export const toPayload = (draft: RubricDraft) => ({
  p_dimensions: draft.dimensions.map((d) => ({ title: d.title.trim(), levels: d.levels })),
  p_bands: [...draft.bands]
    .sort((a, b) => b.min_score - a.min_score)
    .map(({ key: _key, ...band }) => band),
})
