// The budget an RFP states: read into a checked amount or range, shown short ("$95K–$125K"), and parsed back
// from what a person types. See docs/specs/step-1-evaluate.md, "Budget pill".
// An identical copy lives in supabase/functions/sync-rfp-folder/ (functions deploy independently).

/** What the reader returns. A zero means the RFP did not give that number. */
export type BudgetRead = { low: number; high: number; qualifier: string; wording: string }

/** A single amount has min = max. "Up to $X" has no min. "At least $X" has no max. */
export type Budget = { min: number | null; max: number | null; qualifier: string; wording: string }

const MAX_PLAUSIBLE_USD = 10_000_000_000

const wholeDollars = (n: unknown): number | null =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= MAX_PLAUSIBLE_USD ? Math.round(n) : null

/** Null when the RFP states no usable amount: "Not stated" is shown, never a guess. */
export function interpretBudget(read: BudgetRead): Budget | null {
  let min = wholeDollars(read.low)
  let max = wholeDollars(read.high)
  if (min === null && max === null) return null
  if (min !== null && max !== null && min > max) [min, max] = [max, min]
  // A qualifier is a few words ("all-inclusive", "plus media"). A longer sentence would swamp the pill, so leave it out.
  const qualifier = read.qualifier.trim()
  const tooLong = qualifier.split(/\s+/).filter(Boolean).length > 6
  return { min, max, qualifier: tooLong ? '' : qualifier.slice(0, 60), wording: read.wording.trim() }
}

const trimZeros = (s: string) => s.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')

/** 950 -> $950, 95000 -> $95K, 87500 -> $87.5K, 1250000 -> $1.25M. */
export function formatUsd(n: number): string {
  if (n >= 1000) {
    const thousands = Math.round(n / 100) / 10
    if (thousands < 1000) return `$${trimZeros(thousands.toFixed(1))}K`
    return `$${trimZeros((n / 1_000_000).toFixed(2))}M`
  }
  return `$${n}`
}

/** "$95K", "$95K–$125K", "Up to $100K", "$50K+". Empty when there is no budget. */
export function formatBudget(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return min === max ? formatUsd(min) : `${formatUsd(min)}–${formatUsd(max)}`
  if (max !== null) return `Up to ${formatUsd(max)}`
  if (min !== null) return `${formatUsd(min)}+`
  return ''
}

/** Parses what a person types: "95000", "$95,000", "95k", "1.2m". Blank is fine (no amount); anything else is invalid. */
export function parseUsdInput(text: string): { ok: true; value: number | null } | { ok: false } {
  const cleaned = text.replace(/[$,\s]/g, '')
  if (cleaned === '') return { ok: true, value: null }
  const m = /^(\d+(?:\.\d+)?)([km])?$/i.exec(cleaned)
  if (!m) return { ok: false }
  const factor = m[2]?.toLowerCase() === 'm' ? 1_000_000 : m[2]?.toLowerCase() === 'k' ? 1000 : 1
  const value = Math.round(Number(m[1]) * factor)
  return value > 0 && value <= MAX_PLAUSIBLE_USD ? { ok: true, value } : { ok: false }
}

export type BudgetInput = { ok: true; min: number | null; max: number | null } | { ok: false }

/**
 * Parses a budget the way a person writes it: "95k", "$95K–$125K", "95k to 125k", "up to 100k", "at least 50k", "50k+".
 * Blank means no budget.
 */
export function parseBudgetInput(text: string): BudgetInput {
  const t = text.trim().toLowerCase()
  if (t === '') return { ok: true, min: null, max: null }

  const amount = (part: string): number | null => {
    const r = parseUsdInput(part)
    return r.ok ? r.value : null
  }

  const upTo = /^(?:up to|upto|max(?:imum)?|under)\s+(.+)$/.exec(t)
  if (upTo) {
    const max = amount(upTo[1])
    return max === null ? { ok: false } : { ok: true, min: null, max }
  }

  const atLeast = /^(?:at least|min(?:imum)?|over)\s+(.+)$/.exec(t) ?? /^(.+?)\s*\+$/.exec(t)
  if (atLeast) {
    const min = amount(atLeast[1])
    return min === null ? { ok: false } : { ok: true, min, max: null }
  }

  const parts = t.split(/\s*(?:–|—|-|\bto\b)\s*/)
  if (parts.length === 2) {
    const [a, b] = [amount(parts[0]), amount(parts[1])]
    if (a === null || b === null) return { ok: false }
    return { ok: true, min: Math.min(a, b), max: Math.max(a, b) }
  }

  const single = amount(t)
  return single === null ? { ok: false } : { ok: true, min: single, max: single }
}
