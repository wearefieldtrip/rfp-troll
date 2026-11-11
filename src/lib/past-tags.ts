// What the AI's tags from a past RFP's proposal Doc change on that RFP (docs/specs/tagging.md, Backfill).
// It only adds. It never touches a tag from the tracker or one a person set, and a re-run replaces only the AI's own
// earlier unconfirmed tags. Pure, so it is tested. An identical copy lives in supabase/functions/tag-past-rfps/.
import type { ReviewTags } from './review-tags.ts'

export type ExistingTag = { id: string; tag_value_id: string; tag_group: string; source: string; confirmed: boolean }
export type ValueRef = { id: string; tag_group: string; value: string; status: string }

/**
 * What the AI adds to a past RFP: requirements, and a sector only when the RFP has none. The tracker already gives services,
 * and a small model's topics and audiences were too noisy to keep, so those are no longer written (a topic it wants is only
 * suggested for the Library).
 */
export const AI_GROUPS = ['requirements'] as const

/** Groups an earlier version of the tagging wrote and this one does not: its unconfirmed AI tags are cleared. */
export const RETIRED_GROUPS = ['services', 'topics', 'audiences'] as const

/** The most tags one group may get from a proposal. A proposal describes Fieldtrip as well as the RFP, so more is noise. */
export const TAG_CAPS = { requirements: 4 } as const

/** Keeps the first few, in the order the model gave them (most important first). */
export function capTags(tags: ReviewTags): ReviewTags {
  return { ...tags, requirements: tags.requirements.slice(0, TAG_CAPS.requirements) }
}

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

  // Earlier versions also wrote services, topics and audiences. Clear their unconfirmed guesses; never a confirmed or hand-set tag.
  for (const group of RETIRED_GROUPS) {
    if (byHand.has(group)) continue
    plan.deleteIds.push(...existing.filter((e) => e.tag_group === group && isAiGuess(e)).map((e) => e.id))
  }

  const wanted: Record<string, string[]> = { requirements: tags.requirements }
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
