// The tag groups (docs/specs/tagging.md). The values in each group live in the database and are kept in Library → Tags.

export const TAG_GROUPS = [
  { key: 'client_type', label: 'Client type', answers: 'Who the client is', many: false, automatic: false },
  { key: 'sector', label: 'Sector', answers: "What field they're in", many: false, automatic: false },
  { key: 'services', label: 'Services', answers: 'What they want from us', many: true, automatic: false },
  { key: 'topics', label: 'Topic', answers: 'What the work is about', many: true, automatic: false },
  { key: 'audiences', label: 'Audience', answers: 'Who it must reach', many: true, automatic: false },
  { key: 'budget_band', label: 'Budget band', answers: 'How big it is', many: false, automatic: true },
  { key: 'geography', label: 'Geography', answers: 'Where it is', many: true, automatic: true },
  { key: 'procurement', label: 'Procurement', answers: 'What kind of process', many: true, automatic: true },
  { key: 'requirements', label: 'Requirements', answers: 'What comes with it', many: true, automatic: false },
] as const

export type TagGroupKey = (typeof TAG_GROUPS)[number]['key']

export const isTagGroup = (value: string): value is TagGroupKey => TAG_GROUPS.some((g) => g.key === value)

export type TagValue = { id: string; tag_group: string; value: string; status: string }

// The budget bands are ranges in a fixed order, so they are not sorted by name.
const BUDGET_ORDER = ['Under $50K', '$50–100K', '$100–250K', '$250K+', 'Not stated']

/** The values of one group in the order they are shown. */
export function valuesOf<T extends TagValue>(values: T[], group: TagGroupKey, status: 'approved' | 'suggested' = 'approved'): T[] {
  const inGroup = values.filter((v) => v.tag_group === group && v.status === status)
  if (group === 'budget_band') {
    const rank = (v: string) => (BUDGET_ORDER.includes(v) ? BUDGET_ORDER.indexOf(v) : BUDGET_ORDER.length)
    return inGroup.sort((a, b) => rank(a.value) - rank(b.value) || a.value.localeCompare(b.value))
  }
  return inGroup.sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: 'base' }))
}

/** Approved values nobody has used yet are the only ones that can be removed; suggestions can always be rejected. */
export const canRemove = (value: Pick<TagValue, 'status'>, usedBy: number) => value.status === 'suggested' || usedBy === 0

/** Trimmed, spaces collapsed. Empty when there is nothing to add. */
export const cleanValue = (input: string) => input.replace(/\s+/g, ' ').trim()

/** True when the group already has this value, however it is capitalized. */
export const hasValue = (values: TagValue[], group: TagGroupKey, value: string) =>
  values.some((v) => v.tag_group === group && v.value.toLowerCase() === cleanValue(value).toLowerCase())
