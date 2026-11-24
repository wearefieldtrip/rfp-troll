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

export const WEIGHTS = { services: 6, sector: 2, clientType: 2, topics: 2, budget: 1 } as const
const MAX_POINTS = Object.values(WEIGHTS).reduce((a, b) => a + b, 0)

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

/**
 * How well a past RFP's tags cover the current RFP's. Half is how much of the smaller list the two share (a past RFP that
 * did only a website still matches a website RFP fully), half is how much of the current RFP's list the past one covers
 * (more shared is better). Shared ÷ combined was used first and sank good matches: an RFP the AI tagged with seven services
 * could score at most 1/7 against a past RFP that did one of them. Nothing on either side is no overlap, not a perfect one.
 */
export function overlap(a: string[], b: string[]): { ratio: number; shared: string[] } {
  const bSet = new Set(b.map(lower))
  const aUnique = [...new Set(a.map(lower))]
  const shared = [...new Set(a)].filter((v) => bSet.has(lower(v)))
  const smaller = Math.min(aUnique.length, bSet.size)
  if (smaller === 0 || shared.length === 0) return { ratio: 0, shared }
  return { ratio: 0.5 * (shared.length / smaller) + 0.5 * (shared.length / aUnique.length), shared }
}

export function budgetClose(a: string | null, b: string | null): boolean {
  const [i, j] = [a ? BANDS.indexOf(a) : -1, b ? BANDS.indexOf(b) : -1]
  return i >= 0 && j >= 0 && Math.abs(i - j) <= 1
}

export type SimilarityScore = {
  /** Out of 13 before recency, so at most 13. Recency is applied after, and this is what the list is ordered by. */
  score: number
  /** How closely the tags match, 0 to 100: the points before recency out of the most they could earn. Age doesn't change it. */
  percent: number
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
    percent: Math.round((raw / MAX_POINTS) * 100),
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

/**
 * The best matches first, by the percentage shown. A candidate with nothing in common is left out. Age no longer moves a
 * match up or down the list; it only breaks a tie (the same percentage), newer first.
 */
export function rankSimilar<T>(current: SimilarityProfile, candidates: Candidate<T>[], limit: number, now: Date = new Date()) {
  return candidates
    .map((c) => ({ item: c.item, year: c.year, ...scoreSimilarity(current, c.profile, now) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.percent - a.percent || b.score - a.score || b.year - a.year)
    .slice(0, limit)
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
