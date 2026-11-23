import assert from 'node:assert/strict'
import { test } from 'node:test'
import { budgetClose, overlap, profileFromTags, rankSimilar, recency, scoreSimilarity, trackRecord, WEIGHTS, whyMatched, type SimilarityProfile, rankWithPins } from './similarity.ts'

const NOW = new Date('2026-11-11T12:00:00Z')
const profile = (over: Partial<SimilarityProfile> = {}): SimilarityProfile => ({
  services: ['Brand strategy', 'Website'],
  topics: [],
  sector: 'Transit',
  clientType: 'Civic / government',
  budgetBand: null,
  year: 2026,
  ...over,
})

test('recency fades with age: 1, 0.85, 0.7, then 0.5', () => {
  assert.deepEqual([2026, 2025, 2024, 2023, 2019].map((y) => recency(y, NOW)), [1, 0.85, 0.7, 0.5, 0.5])
  assert.equal(recency(2027, NOW), 1)
})

test('overlap is shared over combined, and nothing on both sides is zero', () => {
  assert.deepEqual(overlap(['A', 'B'], ['b', 'C']), { ratio: 1 / 3, shared: ['B'] })
  assert.equal(overlap([], []).ratio, 0)
  assert.equal(overlap(['A'], ['A']).ratio, 1)
})

test('budget bands match when the same or next to each other; not stated never matches', () => {
  assert.equal(budgetClose('$50–100K', '$50–100K'), true)
  assert.equal(budgetClose('$50–100K', '$100–250K'), true)
  assert.equal(budgetClose('Under $50K', '$100–250K'), false)
  assert.equal(budgetClose('Not stated', 'Not stated'), false)
  assert.equal(budgetClose(null, '$250K+'), false)
})

test('an identical RFP this year scores the most the weights allow', () => {
  const full = profile({ topics: ['recycling'], budgetBand: '$100–250K' })
  const s = scoreSimilarity(full, full, NOW)
  assert.equal(s.score, WEIGHTS.services + WEIGHTS.sector + WEIGHTS.clientType + WEIGHTS.topics + WEIGHTS.budget)
  assert.equal(s.score, 12)
})

test('the signals add up as the spec says, then recency multiplies', () => {
  const current = profile()
  // Same sector (3) and client type (2), and one of three services shared (4 × 1/3 = 1.33): 6.33, a year ago × 0.85.
  const past = profile({ services: ['Website', 'Campaign'], year: 2025 })
  const s = scoreSimilarity(current, past, NOW)
  assert.equal(s.score, Math.round((4 / 3 + 3 + 2) * 0.85 * 100) / 100)
  assert.deepEqual(s.sharedServices, ['Website'])
  assert.equal(s.sameSector, true)
  assert.equal(s.recency, 0.85)
})

test('a different sector and client type score only on services', () => {
  const s = scoreSimilarity(profile(), profile({ sector: 'K-12', clientType: 'Education' }), NOW)
  assert.equal(s.score, 4)
  assert.equal(s.sameSector, false)
})

test('missing tags score nothing rather than matching each other', () => {
  const bare = profile({ services: [], sector: null, clientType: null })
  assert.equal(scoreSimilarity(bare, bare, NOW).score, 0)
})

test('the best matches come first, ties go to the more recent, and nothing in common is left out', () => {
  const current = profile()
  const ranked = rankSimilar(
    current,
    [
      { item: 'older twin', year: 2023, profile: profile({ year: 2023 }) },
      { item: 'newer twin', year: 2026, profile: profile({ year: 2026 }) },
      { item: 'unrelated', year: 2026, profile: profile({ services: ['Signage & wayfinding'], sector: 'Health', clientType: 'Nonprofit' }) },
      { item: 'partial', year: 2026, profile: profile({ services: ['Website'], sector: 'K-12', clientType: 'Education' }) },
    ],
    5,
    NOW,
  )
  assert.deepEqual(ranked.map((r) => r.item), ['newer twin', 'older twin', 'partial'])
  assert.equal(rankSimilar(current, [{ item: 'a', year: 2026, profile: profile() }], 0, NOW).length, 0)
})

test('the profile is read from an RFP\'s tags', () => {
  const p = profileFromTags(
    [
      { tag_group: 'services', value: 'Website' },
      { tag_group: 'services', value: 'Campaign' },
      { tag_group: 'sector', value: 'Transit' },
      { tag_group: 'client_type', value: 'Civic / government' },
      { tag_group: 'budget_band', value: '$50–100K' },
      { tag_group: 'topics', value: 'ridership' },
      { tag_group: 'geography', value: 'KY' },
    ],
    2025,
  )
  assert.deepEqual(p, { services: ['Website', 'Campaign'], topics: ['ridership'], sector: 'Transit', clientType: 'Civic / government', budgetBand: '$50–100K', year: 2025 })
})

test('why it matched is a few words', () => {
  const s = scoreSimilarity(profile({ topics: ['recycling'], budgetBand: '$50–100K' }), profile({ topics: ['recycling'], budgetBand: '$100–250K' }), NOW)
  assert.deepEqual(whyMatched(s), ['Shared services: Brand strategy, Website', 'Same sector', 'Same client type', 'Shared topics: recycling', 'Similar budget'])
})

test('the track record counts wins, finalists and the rest', () => {
  assert.equal(
    trackRecord([
      { outcome: 'won', stage: null },
      { outcome: 'lost', stage: 'pitched' },
      { outcome: 'lost', stage: 'finalist' },
      { outcome: 'lost', stage: 'submitted' },
      { outcome: 'no_response', stage: 'submitted' },
    ]),
    'Among the 5 most similar: 1 won, 2 finalist or pitched, 2 lost or no response.',
  )
  assert.equal(trackRecord([]), null)
})

test('picked RFPs come first whatever their score, and are not repeated', () => {
  const now = new Date('2026-06-01')
  const mk = (id: string, services: string[]) => ({ item: { id }, year: 2026, profile: { services, topics: [], sector: null, clientType: null, budgetBand: null, year: 2026 } })
  const current = { services: ['A'], topics: [], sector: null, clientType: null, budgetBand: null, year: 2026 }
  const candidates = [mk('best', ['A']), mk('unrelated', ['Z']), mk('ok', ['A', 'B'])]
  const list = rankWithPins(current, candidates, ['unrelated'], 2, now)
  assert.deepEqual(list.map((m) => [m.item.id, m.pinned]), [['unrelated', true], ['best', false]])
  assert.equal(list[0].score, 0)
  // A pick that isn't a candidate is ignored; no picks behaves like the plain ranking.
  assert.deepEqual(rankWithPins(current, candidates, ['gone'], 5, now).map((m) => m.item.id), ['best', 'ok'])
})
