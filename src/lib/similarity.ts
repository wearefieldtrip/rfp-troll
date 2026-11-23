// How alike two RFPs are (docs/specs/tagging.md, "Similarity"). Pure, so it is tested; the weights are the spec's
// starting weights and live in one place to tune later.

export type SimilarityProfile = {
  services: string[]
  topics: string[]
  sector: string | null
  clientType: string | null
  budgetBand: string | null
  /** The year it was submitted (past) or added (current). */
  year: number
}

export const WEIGHTS = { services: 4, sector: 3, clientType: 2, topics: 2, budget: 1 } as const

/** In order, so "adjacent" means next to each other. "Not stated" never matches. */
const BANDS = ['Under $50K', '$50–100K', '$100–250K', '$250K+']

/** This year 1.0, last year 0.85, two years back 0.7, older 0.5. */
export function recency(year: number, now: Date = new Date()): number {
  const age = now.getFullYear() - year
  if (age <= 0) return 1
  if (age === 1) return 0.85
  if (age === 2) return 0.7
  return 0.5
}

const lower = (s: string) => s.toLowerCase()

/** Shared ÷ combined. Nothing on either side is no overlap, not a perfect one. */
export function overlap(a: string[], b: string[]): { ratio: number; shared: string[] } {
  const bSet = new Set(b.map(lower))
  const shared = [...new Set(a)].filter((v) => bSet.has(lower(v)))
  const combined = new Set([...a.map(lower), ...b.map(lower)]).size
  return { ratio: combined === 0 ? 0 : shared.length / combined, shared }
}

export function budgetClose(a: string | null, b: string | null): boolean {
  const [i, j] = [a ? BANDS.indexOf(a) : -1, b ? BANDS.indexOf(b) : -1]
  return i >= 0 && j >= 0 && Math.abs(i - j) <= 1
}

export type SimilarityScore = {
  /** Out of 12 before recency, so at most 12. */
  score: number
  sharedServices: string[]
  sharedTopics: string[]
  sameSector: boolean
  sameClientType: boolean
  closeBudget: boolean
  recency: number
}

const same = (a: string | null, b: string | null) => !!a && !!b && lower(a) === lower(b)

export function scoreSimilarity(current: SimilarityProfile, past: SimilarityProfile, now: Date = new Date()): SimilarityScore {
  const services = overlap(current.services, past.services)
  const topics = overlap(current.topics, past.topics)
  const sameSector = same(current.sector, past.sector)
  const sameClientType = same(current.clientType, past.clientType)
  const closeBudget = budgetClose(current.budgetBand, past.budgetBand)
  const factor = recency(past.year, now)

  const raw =
    WEIGHTS.services * services.ratio +
    (sameSector ? WEIGHTS.sector : 0) +
    (sameClientType ? WEIGHTS.clientType : 0) +
    WEIGHTS.topics * topics.ratio +
    (closeBudget ? WEIGHTS.budget : 0)

  return {
    score: Math.round(raw * factor * 100) / 100,
    sharedServices: services.shared,
    sharedTopics: topics.shared,
    sameSector,
    sameClientType,
    closeBudget,
    recency: factor,
  }
}

/** The tags of one RFP as the profile the score uses. */
export function profileFromTags(tags: { tag_group: string; value: string }[], year: number): SimilarityProfile {
  const all = (group: string) => tags.filter((t) => t.tag_group === group).map((t) => t.value)
  return {
    services: all('services'),
    topics: all('topics'),
    sector: all('sector')[0] ?? null,
    clientType: all('client_type')[0] ?? null,
    budgetBand: all('budget_band')[0] ?? null,
    year,
  }
}

export type Candidate<T> = { item: T; profile: SimilarityProfile; year: number }

/** The best matches first. A candidate with nothing in common is left out. Ties go to the more recent. */
export function rankSimilar<T>(current: SimilarityProfile, candidates: Candidate<T>[], limit: number, now: Date = new Date()) {
  return candidates
    .map((c) => ({ item: c.item, year: c.year, ...scoreSimilarity(current, c.profile, now) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || b.year - a.year)
    .slice(0, limit)
}

/**
 * The matches to show: the ones a person picked first (whatever their score), then the best of the rest.
 * A picked RFP that isn't among the candidates (for example it has no proposal Doc when one is needed) is left out.
 */
export function rankWithPins<T extends { id: string }>(current: SimilarityProfile, candidates: Candidate<T>[], pinnedIds: string[], limit: number, now: Date = new Date()) {
  const pins = new Set(pinnedIds)
  const scored = (c: Candidate<T>) => ({ item: c.item, year: c.year, ...scoreSimilarity(current, c.profile, now) })
  const picked = pinnedIds
    .map((id) => candidates.find((c) => c.item.id === id))
    .filter((c): c is Candidate<T> => !!c)
    .map((c) => ({ ...scored(c), pinned: true }))
  const rest = rankSimilar(current, candidates.filter((c) => !pins.has(c.item.id)), limit, now).map((m) => ({ ...m, pinned: false }))
  return [...picked, ...rest].slice(0, Math.max(limit, picked.length))
}

/** Why a past RFP matched, in a few words. */
export function whyMatched(s: SimilarityScore): string[] {
  const why: string[] = []
  if (s.sharedServices.length > 0) why.push(`Shared services: ${s.sharedServices.join(', ')}`)
  if (s.sameSector) why.push('Same sector')
  if (s.sameClientType) why.push('Same client type')
  if (s.sharedTopics.length > 0) why.push(`Shared topics: ${s.sharedTopics.join(', ')}`)
  if (s.closeBudget) why.push('Similar budget')
  return why
}

/** "Among the 5 most similar: 1 won, 2 finalist or pitched, 2 lost." Null with nothing to say. */
export function trackRecord(matches: { outcome: string | null; stage: string | null }[]): string | null {
  if (matches.length === 0) return null
  const won = matches.filter((m) => m.outcome === 'won').length
  const far = matches.filter((m) => m.outcome !== 'won' && (m.stage === 'finalist' || m.stage === 'pitched')).length
  const lost = matches.length - won - far
  const parts = [won && `${won} won`, far && `${far} finalist or pitched`, lost && `${lost} lost or no response`].filter(Boolean)
  return `Among the ${matches.length} most similar: ${parts.join(', ')}.`
}
