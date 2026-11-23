// Tags from a fit review (docs/specs/tagging.md): the schema and prompt text the model sees, a check of what it returns
// against the Library's lists, and the facts-based tags worked out from the RFP's own details.
// An identical copy lives in supabase/functions/review-rfp/ (functions deploy independently).

export const LIST_GROUPS = ['client_type', 'sector', 'services', 'topics', 'audiences', 'requirements', 'procurement'] as const
export type ListGroup = (typeof LIST_GROUPS)[number]

/** The approved values of each group the model may choose from. */
export type TagLists = Record<ListGroup, string[]>

/** Groups the model may suggest a new value for. */
export const SUGGESTABLE = ['sector', 'services', 'topics', 'audiences', 'requirements'] as const
const MAX_SUGGESTED = 3

/** The most services one RFP gets. The model lists them most important first; the rest are dropped. */
export const MAX_SERVICES = 4

export type SuggestedValue = { group: string; value: string }

export type ReviewTags = {
  client_type: string | null
  sector: string | null
  services: string[]
  topics: string[]
  audiences: string[]
  requirements: string[]
  procurement: string[]
  /** Two letters, or null when the RFP shows none. */
  state: string | null
  suggested_new: SuggestedValue[]
}

const str = { type: 'string' }
// An enum can't be empty, so a group with no values accepts only "none".
const choice = (values: string[]) => ({ type: 'string', enum: [...values, ''] })
const choices = (values: string[]) => ({ type: 'array', items: { type: 'string', enum: values.length > 0 ? values : [''] } })

export function tagsSchema(lists: TagLists) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['client_type', 'sector', 'services', 'topics', 'audiences', 'requirements', 'procurement', 'state', 'suggested_new'],
    properties: {
      client_type: choice(lists.client_type),
      sector: choice(lists.sector),
      services: choices(lists.services),
      topics: choices(lists.topics),
      audiences: choices(lists.audiences),
      requirements: choices(lists.requirements),
      procurement: choices(lists.procurement),
      state: str,
      suggested_new: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['group', 'value'],
          properties: { group: { type: 'string', enum: [...SUGGESTABLE] }, value: str },
        },
      },
    },
  }
}

/** The tags part of the review instructions, with the lists written out. */
export function tagsPrompt(lists: TagLists): string {
  const list = (g: ListGroup) => `${g}: ${lists[g].join('; ') || '(none yet)'}`
  return `- tags: choose only from the lists below, never invent a value that is in a list.
  - client_type and sector: one value each, or an empty string when none fits. sector describes the client; topics describe the work.
  - services: only the core work this RFP asks a vendor to deliver, most important first, usually one to three and never more than ${MAX_SERVICES}. Take them from the title and the scope of work. Leave out anything that is only an add-on, optional, a possible later phase, background about the client, or a requirement on how the work is done (accessibility, translation, training and ongoing support count only when they are a main deliverable). A website RFP is just Website unless the scope asks for the others as work to be delivered. Do not add Brand strategy, Visual identity or Campaign because a website will reflect a brand or support a campaign.
  - topics, audiences, requirements: every value the RFP clearly asks for or points to, or an empty list.
  - procurement: the kind of process. Include the document type (RFP, RFI or RFQ) and public or private when clear. Include multi-year, agency of record, pitch round or DBE/WBE preference only when the RFP says so.
  - state: the two-letter US state where the issuer is based, or an empty string.
  - suggested_new: at most ${MAX_SUGGESTED} short values worth adding when something important has no match in a list, each with its group (${SUGGESTABLE.join(', ')}). Usually an empty list.

Tag lists:
${LIST_GROUPS.map(list).join('\n')}`
}

const clean = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '')

/** The list's own spelling of a value, or null when it isn't in the list. */
function canonical(list: string[], value: string): string | null {
  const wanted = value.toLowerCase()
  return list.find((v) => v.toLowerCase() === wanted) ?? null
}

/** What the model returned, kept only where it matches the lists. Anything else is dropped, never stored. */
export function buildTags(raw: unknown, lists: TagLists): ReviewTags {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const one = (g: ListGroup) => canonical(lists[g], clean(r[g]))
  const many = (g: ListGroup) => {
    const out: string[] = []
    for (const item of Array.isArray(r[g]) ? r[g] : []) {
      const value = canonical(lists[g], clean(item))
      if (value && !out.includes(value)) out.push(value)
    }
    return out
  }

  const suggested: SuggestedValue[] = []
  for (const item of Array.isArray(r.suggested_new) ? r.suggested_new : []) {
    const group = clean((item as Record<string, unknown>)?.group)
    const value = clean((item as Record<string, unknown>)?.value)
    if (!(SUGGESTABLE as readonly string[]).includes(group) || !value || value.length > 60) continue
    // Already in the list, or already suggested: nothing to suggest.
    if (canonical(lists[group as ListGroup], value)) continue
    if (suggested.some((s) => s.group === group && s.value.toLowerCase() === value.toLowerCase())) continue
    suggested.push({ group, value })
  }

  const state = clean(r.state).toUpperCase()
  return {
    client_type: one('client_type'),
    sector: one('sector'),
    services: many('services').slice(0, MAX_SERVICES),
    topics: many('topics'),
    audiences: many('audiences'),
    requirements: many('requirements'),
    procurement: many('procurement'),
    state: /^[A-Z]{2}$/.test(state) ? state : null,
    suggested_new: suggested.slice(0, MAX_SUGGESTED),
  }
}

/**
 * The band for a stated budget: the middle of a range, the single amount, or the one bound given.
 * An estimate from a Form 990 never sets it, so the caller passes only a stated budget.
 */
export function budgetBand(min: number | null, max: number | null): string {
  const amount = min !== null && max !== null ? (min + max) / 2 : (min ?? max)
  if (amount === null) return 'Not stated'
  if (amount < 50_000) return 'Under $50K'
  if (amount < 100_000) return '$50–100K'
  if (amount < 250_000) return '$100–250K'
  return '$250K+'
}

/** Louisville/KY or out of state, plus the state itself. Nothing when the RFP shows no state. */
export function geographyValues(state: string | null): string[] {
  if (!state) return []
  return [state === 'KY' ? 'Louisville/KY' : 'Out of state', state]
}
