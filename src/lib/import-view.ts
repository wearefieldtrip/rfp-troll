// How the import screen words things. Pure, so it is tested.
import type { ImportRowPlan } from './functions.ts'

export const OUTCOME_LABELS: Record<string, string> = {
  won: 'Won',
  lost: 'Lost',
  no_response: 'No response',
  qualified: 'Qualified',
  unknown: 'Unknown',
}

export const STAGE_LABELS: Record<string, string> = { submitted: 'Submitted', finalist: 'Finalist', pitched: 'Pitched' }

export const ACTION_LABELS: Record<ImportRowPlan['action'], string> = {
  create: 'New',
  update: 'Update',
  skip_reviewed: 'Reviewed, left alone',
}

/** "3 new · 1 updated · 2 left alone", leaving out what is zero. */
export function describeActions(actions: Record<string, number>): string {
  const parts = [
    actions.create ? `${actions.create} new` : '',
    actions.update ? `${actions.update} updated` : '',
    actions.skip_reviewed ? `${actions.skip_reviewed} left alone (already reviewed)` : '',
  ].filter(Boolean)
  return parts.join(' · ') || 'Nothing to do'
}

/** "2 won · 5 lost", in a fixed order. */
export function describeOutcomes(outcomes: Record<string, number>): string {
  return ['won', 'lost', 'no_response', 'qualified', 'unknown']
    .filter((k) => outcomes[k])
    .map((k) => `${outcomes[k]} ${OUTCOME_LABELS[k].toLowerCase()}`)
    .join(' · ')
}

/** A row number box: a whole number from 2 up (row 1 is the header), or nothing. */
export function parseRowNumber(text: string): number | undefined | 'invalid' {
  const t = text.trim()
  if (t === '') return undefined
  const n = Number(t)
  return Number.isInteger(n) && n >= 2 ? n : 'invalid'
}

/** "37 linked · 13 can't be opened · 31 with a PDF", leaving out what is zero. */
export function describeLinks(summary: { linked: number; no_access: number; not_a_doc: number; no_link: number; withPdf: number }): string {
  return [
    summary.linked ? `${summary.linked} linked` : '',
    summary.no_access ? `${summary.no_access} can't be opened` : '',
    summary.not_a_doc ? `${summary.not_a_doc} not a Google Doc` : '',
    summary.no_link ? `${summary.no_link} with no link` : '',
    summary.withPdf ? `${summary.withPdf} with a PDF` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

const GROUP_LABELS: Record<string, string> = { sector: 'Sector', requirements: 'Requirements' }

/** "Services: Translation, Accessibility · Topics: recycling", in a fixed order. Empty when nothing was added. */
export function describeAdded(added: Record<string, string[]> | undefined): string {
  if (!added) return ''
  return Object.keys(GROUP_LABELS)
    .filter((g) => added[g]?.length)
    .map((g) => `${GROUP_LABELS[g]}: ${added[g].join(', ')}`)
    .join(' · ')
}
