// What the AI's tags from a past RFP's proposal Doc change on that RFP (docs/specs/tagging.md, Backfill).
// It only adds. It never touches a tag from the tracker or one a person set, and a re-run replaces only the AI's own
// earlier unconfirmed tags. Pure, so it is tested. An identical copy lives in supabase/functions/tag-past-rfps/.
import type { ReviewTags } from './review-tags.ts'

export type ExistingTag = { id: string; tag_value_id: string; tag_group: string; source: string; confirmed: boolean }
export type ValueRef = { id: string; tag_group: string; value: string; status: string }

/** Groups the tracker doesn't hold well, which the AI adds to. Sector is added only when the RFP has none. */
export const AI_GROUPS = ['services', 'topics', 'audiences', 'requirements'] as const

export type PastTagPlan = {
  /** Earlier unconfirmed AI tags to remove before adding the new ones. */
  deleteIds: string[]
  /** Tag values to add as unconfirmed AI tags. */
  addValueIds: string[]
  /** What was added, by group, for showing the result. */
  added: Record<string, string[]>
}

const isAiGuess = (t: Pick<ExistingTag, 'source' | 'confirmed'>) => t.source === 'ai' && !t.confirmed

export function planPastTags(existing: ExistingTag[], tags: ReviewTags, values: ValueRef[]): PastTagPlan {
  const plan: PastTagPlan = { deleteIds: [], addValueIds: [], added: {} }
  const byHand = new Set(existing.filter((e) => e.source === 'person').map((e) => e.tag_group))

  const wanted: Record<string, string[]> = {
    services: tags.services,
    topics: tags.topics,
    audiences: tags.audiences,
    requirements: tags.requirements,
  }
  // The tracker's sector, or one a person chose, stands. Only an RFP with none (or only an earlier AI guess) gets one.
  const sectorRows = existing.filter((e) => e.tag_group === 'sector')
  if (sectorRows.every(isAiGuess)) wanted.sector = tags.sector ? [tags.sector] : []

  for (const [group, names] of Object.entries(wanted)) {
    if (byHand.has(group)) continue
    const inGroup = existing.filter((e) => e.tag_group === group)
    plan.deleteIds.push(...inGroup.filter(isAiGuess).map((e) => e.id))
    const keep = new Set(inGroup.filter((e) => !isAiGuess(e)).map((e) => e.tag_value_id))

    for (const name of names) {
      const value = values.find((v) => v.tag_group === group && v.status === 'approved' && v.value.toLowerCase() === name.toLowerCase())
      if (!value || keep.has(value.id) || plan.addValueIds.includes(value.id)) continue
      plan.addValueIds.push(value.id)
      keep.add(value.id)
      ;(plan.added[group] ??= []).push(value.value)
    }
  }
  return plan
}
