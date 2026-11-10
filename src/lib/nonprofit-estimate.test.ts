import assert from 'node:assert/strict'
import { test } from 'node:test'
import { estimateBudget, estimateRange, matchOrganization, nameMatch, pickFiling } from './nonprofit-estimate.ts'

// Shapes taken from ProPublica's real response for the International Trademark Association (EIN 131427696).
const intaSearch = { organizations: [{ ein: 131427696, name: 'International Trademark Association Inc', city: 'New York', state: 'NY' }] }
const intaOrg = {
  filings_with_data: [
    { tax_prd_yr: 2023, formtype: 0, totfuncexpns: 22169639 },
    { tax_prd_yr: 2022, formtype: 0, totfuncexpns: 20345174 },
  ],
  filings_without_data: [{ tax_prd: 202412, tax_prd_yr: 2024, formtype: 0 }],
}

const fakeFetcher = (routes: { search?: unknown; org?: unknown; fail?: boolean; searchStatus?: number }) => async (url: string) => {
  if (routes.fail) throw new Error('network down')
  const isSearch = url.includes('/search.json')
  const body = isSearch ? routes.search : routes.org
  const status = isSearch && routes.searchStatus ? routes.searchStatus : body !== undefined ? 200 : 500
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

test('size turns into a rough range, rounded to $5K', () => {
  assert.deepEqual(estimateRange(22169639), { low: 65000, high: 200000 }) // INTA
  assert.deepEqual(estimateRange(3_000_000), { low: 10000, high: 30000 })
  assert.deepEqual(estimateRange(100_000), { low: 10000, high: 25000 }) // floors for tiny organizations
  assert.deepEqual(estimateRange(900_000_000), { low: 400000, high: 400000 }) // capped
})

test('the range always has low at or below high and stays a whole number of steps', () => {
  for (const e of [1, 50_000, 250_000, 1_000_000, 5_000_000, 20_000_000, 80_000_000, 1e10]) {
    const r = estimateRange(e)
    assert.ok(r.low <= r.high, String(e))
    assert.equal(r.low % 5000, 0)
    assert.equal(r.high % 5000, 0)
  }
})

test('names match on their words, not their punctuation or legal suffix', () => {
  assert.equal(nameMatch('International Trademark Association', 'International Trademark Association Inc'), 'exact')
  assert.equal(nameMatch('The Kentucky Youth Advocates, Inc.', 'Kentucky Youth Advocates'), 'exact')
  assert.equal(nameMatch('Arts & Culture Council', 'Arts and Culture Council'), 'exact')
  assert.equal(nameMatch('Cedar Falls Parks Department', 'Friends of Cedar Falls Parks'), null)
  assert.equal(nameMatch('Kentucky Youth Advocates', 'Kentucky Youth Advocates Foundation'), null)
  assert.equal(nameMatch('', 'Anything'), null)
})

test('a matching organization is found only when it is clearly the right one', () => {
  assert.deepEqual(matchOrganization(intaSearch.organizations, 'International Trademark Association', 'NY'), {
    ein: '131427696',
    name: 'International Trademark Association Inc',
    state: 'NY',
  })
  assert.equal(matchOrganization(intaSearch.organizations, 'International Trademark Association', 'CA'), 'no_match') // wrong state
  assert.equal(matchOrganization([], 'Anything', 'NY'), 'no_match')
})

test('without a state, only an exact name is trusted', () => {
  assert.notEqual(matchOrganization(intaSearch.organizations, 'International Trademark Association', null), 'no_match')
  const close = [{ ein: 1, name: 'Harbor Arts Council Foundation Group North', state: 'MD' }]
  assert.equal(matchOrganization(close, 'Harbor Arts Council Foundation Group', null), 'no_match')
})

test('two organizations with the same name and state are refused, not guessed', () => {
  const twins = [
    { ein: 111111111, name: 'United Way of Greater Louisville', state: 'KY' },
    { ein: 222222222, name: 'United Way of Greater Louisville', state: 'KY' },
  ]
  assert.equal(matchOrganization(twins, 'United Way of Greater Louisville', 'KY'), 'ambiguous')
})

test('the latest full 990 with numbers is used, even when a newer one has no numbers yet', () => {
  const picked = pickFiling(intaOrg)
  assert.ok('filing' in picked)
  assert.equal(picked.filing.tax_prd_yr, 2023)
})

test('an organization that moved to a 990-EZ, or has no filings, gets no estimate', () => {
  const moved = { filings_with_data: [{ tax_prd_yr: 2022, formtype: 0, totfuncexpns: 900000 }], filings_without_data: [{ tax_prd_yr: 2024, formtype: 1 }] }
  assert.deepEqual(pickFiling(moved), { reason: 'not_full_990' })
  assert.deepEqual(pickFiling({ filings_with_data: [{ tax_prd_yr: 2023, formtype: 1, totfuncexpns: 90000 }] }), { reason: 'not_full_990' })
  assert.deepEqual(pickFiling({}), { reason: 'no_filings' })
  assert.deepEqual(pickFiling({ filings_with_data: [] }), { reason: 'no_filings' })
})

test('the whole lookup produces the estimate and what it was based on', async () => {
  const r = await estimateBudget({ name: 'International Trademark Association', state: 'NY', type: 'nonprofit' }, fakeFetcher({ search: intaSearch, org: intaOrg }))
  assert.equal(r.status, 'estimated')
  if (r.status !== 'estimated') return
  assert.deepEqual([r.low, r.high], [65000, 200000])
  assert.equal(r.ein, '131427696')
  assert.equal(r.tax_year, 2023)
  assert.equal(r.total_expenses, 22169639)
  assert.equal(r.org_name, 'International Trademark Association Inc')
})

test('government bodies and for-profits are never looked up', async () => {
  const boom = fakeFetcher({ fail: true })
  assert.deepEqual(await estimateBudget({ name: 'Cedar Falls Parks Department', state: 'IA', type: 'government' }, boom), { status: 'unavailable', reason: 'government' })
  assert.deepEqual(await estimateBudget({ name: 'Acme Inc', state: 'IA', type: 'for_profit' }, boom), { status: 'unavailable', reason: 'no_match' })
})

test('a lookup that fails never throws and never invents an estimate', async () => {
  assert.deepEqual(await estimateBudget({ name: 'Anything', state: 'NY', type: 'nonprofit' }, fakeFetcher({ fail: true })), { status: 'unavailable', reason: 'lookup_failed' })
  assert.deepEqual(await estimateBudget({ name: 'Anything', state: 'NY', type: 'nonprofit' }, fakeFetcher({})), { status: 'unavailable', reason: 'lookup_failed' })
  assert.deepEqual(await estimateBudget({ name: 'Nobody', state: 'NY', type: 'unknown' }, fakeFetcher({ search: { organizations: [] } })), { status: 'unavailable', reason: 'no_match' })
})

test('a search that finds nothing (ProPublica answers 404 with an empty result) is "no match", not a failure', async () => {
  const empty = { total_results: 0, organizations: [] }
  assert.deepEqual(
    await estimateBudget({ name: 'Riverbend Youth Wellness Alliance', state: 'KY', type: 'nonprofit' }, fakeFetcher({ search: empty, searchStatus: 404 })),
    { status: 'unavailable', reason: 'no_match' },
  )
  // Other errors are still failures.
  assert.deepEqual(
    await estimateBudget({ name: 'Anything', state: 'NY', type: 'nonprofit' }, fakeFetcher({ search: empty, searchStatus: 500 })),
    { status: 'unavailable', reason: 'lookup_failed' },
  )
})
