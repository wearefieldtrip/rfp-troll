// A rough budget estimate for an RFP that states none, sized from the issuer's latest full Form 990.
// Data: ProPublica Nonprofit Explorer API (https://projects.propublica.org/nonprofits/api). Its structured data has
// total expenses but not the advertising or outside-fees lines, so the estimate is sized from total expenses alone.
// See docs/specs/step-1-evaluate.md, "Budget pill". An identical copy lives in supabase/functions/sync-rfp-folder/.

export type EstimateOk = {
  status: 'estimated'
  low: number
  high: number
  ein: string
  org_name: string
  state: string | null
  tax_year: number
  total_expenses: number
  rule: string
}

export type UnavailableReason = 'no_match' | 'ambiguous' | 'government' | 'not_full_990' | 'no_filings' | 'lookup_failed'

export type BudgetEstimate = EstimateOk | { status: 'unavailable'; reason: UnavailableReason }

/** The one place that turns an organization's size into a range. Change the numbers here. */
export const RULE = { lowShare: 0.003, highShare: 0.009, minLow: 10_000, minHigh: 25_000, cap: 400_000, step: 5_000 }
export const RULE_TEXT = '0.3% to 0.9% of total expenses, at least $10K to $25K, never above $400K'

export function estimateRange(totalExpenses: number): { low: number; high: number } {
  const { lowShare, highShare, minLow, minHigh, cap, step } = RULE
  const low = Math.min(cap, Math.max(minLow, lowShare * totalExpenses))
  const high = Math.min(cap, Math.max(minHigh, highShare * totalExpenses))
  return { low: Math.floor(low / step) * step, high: Math.ceil(high / step) * step }
}

const FILLER = new Set(['inc', 'incorporated', 'the', 'and', 'of', 'a'])

const tokens = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t && !FILLER.has(t))

/** 'exact' when both names have the same words (ignoring Inc, The, of...), 'close' when they differ by about one word in five. */
export function nameMatch(a: string, b: string): 'exact' | 'close' | null {
  const [x, y] = [new Set(tokens(a)), new Set(tokens(b))]
  if (x.size === 0 || y.size === 0) return null
  const shared = [...x].filter((t) => y.has(t)).length
  if (shared === x.size && shared === y.size) return 'exact'
  return shared / (x.size + y.size - shared) >= 0.8 ? 'close' : null
}

type Candidate = { ein: number | string; name: string; state?: string | null }

/** Picks the one organization that matches, or says why not. A wrong match is worse than none, so ambiguity is refused. */
export function matchOrganization(candidates: Candidate[], name: string, state: string | null): { ein: string; name: string; state: string | null } | 'no_match' | 'ambiguous' {
  const wanted = state?.toUpperCase() ?? null
  let pool = candidates
    .map((c) => ({ c, how: nameMatch(name, c.name) }))
    .filter((m) => m.how !== null)
    .filter((m) => !wanted || (m.c.state ?? '').toUpperCase() === wanted)
  // Without a state to confirm it, only an exact name is trusted.
  if (!wanted) pool = pool.filter((m) => m.how === 'exact')
  if (pool.length === 0) return 'no_match'

  const exact = pool.filter((m) => m.how === 'exact')
  const best = exact.length > 0 ? exact : pool
  const eins = new Set(best.map((m) => String(m.c.ein)))
  if (eins.size !== 1) return 'ambiguous'
  const c = best[0].c
  return { ein: String(c.ein).padStart(9, '0'), name: c.name, state: c.state ?? null }
}

type Filing = { tax_prd_yr: number; formtype: number; totfuncexpns?: number }
type OrganizationResponse = { filings_with_data?: Filing[]; filings_without_data?: Filing[] }

/** The filing to size from: the latest one with numbers, provided the organization still files a full 990 (form type 0). */
export function pickFiling(org: OrganizationResponse): { filing: Filing } | { reason: 'no_filings' | 'not_full_990' } {
  const withData = [...(org.filings_with_data ?? [])].sort((a, b) => b.tax_prd_yr - a.tax_prd_yr)
  const newestAny = [...withData, ...(org.filings_without_data ?? [])].sort((a, b) => b.tax_prd_yr - a.tax_prd_yr)[0]
  if (!newestAny || withData.length === 0) return { reason: 'no_filings' }
  // A newer 990-EZ or 990-PF means the organization no longer files a full 990, so older figures would mislead.
  if (newestAny.formtype !== 0) return { reason: 'not_full_990' }
  const filing = withData[0]
  return filing.formtype === 0 && (filing.totfuncexpns ?? 0) > 0 ? { filing } : { reason: 'not_full_990' }
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>

const API = 'https://projects.propublica.org/nonprofits/api/v2'
const HEADERS = { 'User-Agent': 'RFP Troll (Fieldtrip internal tool)', Accept: 'application/json' }

export type Issuer = { name: string; state: string | null; type: 'nonprofit' | 'government' | 'for_profit' | 'unknown' }

export async function estimateBudget(issuer: Issuer, fetcher: Fetcher = fetch): Promise<BudgetEstimate> {
  if (issuer.type === 'government') return { status: 'unavailable', reason: 'government' }
  if (issuer.type === 'for_profit' || !issuer.name.trim()) return { status: 'unavailable', reason: 'no_match' }

  try {
    const state = issuer.state && /^[A-Za-z]{2}$/.test(issuer.state) ? issuer.state.toUpperCase() : null
    const query = `q=${encodeURIComponent(issuer.name)}${state ? `&state%5Bid%5D=${state}` : ''}`
    const search = await fetcher(`${API}/search.json?${query}`, { headers: HEADERS, signal: AbortSignal.timeout(10_000) })
    // A search that finds nothing is answered with a 404 that still carries an empty result. That is "no match", not a failure.
    if (!search.ok && search.status !== 404) return { status: 'unavailable', reason: 'lookup_failed' }

    const found = matchOrganization(((await search.json()) as { organizations?: Candidate[] }).organizations ?? [], issuer.name, state)
    if (typeof found === 'string') return { status: 'unavailable', reason: found }

    const orgRes = await fetcher(`${API}/organizations/${Number(found.ein)}.json`, { headers: HEADERS, signal: AbortSignal.timeout(10_000) })
    if (!orgRes.ok) return { status: 'unavailable', reason: 'lookup_failed' }

    const picked = pickFiling((await orgRes.json()) as OrganizationResponse)
    if ('reason' in picked) return { status: 'unavailable', reason: picked.reason }

    const expenses = picked.filing.totfuncexpns as number
    return {
      status: 'estimated',
      ...estimateRange(expenses),
      ein: found.ein,
      org_name: found.name,
      state: found.state,
      tax_year: picked.filing.tax_prd_yr,
      total_expenses: expenses,
      rule: RULE_TEXT,
    }
  } catch {
    return { status: 'unavailable', reason: 'lookup_failed' }
  }
}
