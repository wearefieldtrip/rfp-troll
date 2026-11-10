import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatBudget, formatUsd, interpretBudget, parseBudgetInput, parseUsdInput } from './rfp-budget.ts'

const read = (low: number, high: number, qualifier = '', wording = '') => ({ low, high, qualifier, wording })

test('amounts are shown short', () => {
  assert.equal(formatUsd(950), '$950')
  assert.equal(formatUsd(15000), '$15K')
  assert.equal(formatUsd(95000), '$95K')
  assert.equal(formatUsd(125000), '$125K')
  assert.equal(formatUsd(87500), '$87.5K')
  assert.equal(formatUsd(100000), '$100K')
  assert.equal(formatUsd(1000000), '$1M')
  assert.equal(formatUsd(1250000), '$1.25M')
  assert.equal(formatUsd(999999), '$1M') // never "$1000K"
  assert.equal(formatUsd(999949), '$999.9K')
})

test('an amount, a range, "up to" and "at least" each read differently', () => {
  assert.equal(formatBudget(95000, 95000), '$95K')
  assert.equal(formatBudget(95000, 125000), '$95K–$125K')
  assert.equal(formatBudget(null, 100000), 'Up to $100K')
  assert.equal(formatBudget(50000, null), '$50K+')
  assert.equal(formatBudget(null, null), '')
})

test('the reader output becomes a checked budget', () => {
  assert.deepEqual(interpretBudget(read(95000, 125000, ' all-inclusive ', ' $95,000–$125,000 ')), {
    min: 95000,
    max: 125000,
    qualifier: 'all-inclusive',
    wording: '$95,000–$125,000',
  })
  assert.deepEqual(interpretBudget(read(100000, 100000, 'per year, 3 years')), { min: 100000, max: 100000, qualifier: 'per year, 3 years', wording: '' })
  assert.deepEqual(interpretBudget(read(0, 100000)), { min: null, max: 100000, qualifier: '', wording: '' }) // up to
  assert.deepEqual(interpretBudget(read(50000, 0)), { min: 50000, max: null, qualifier: '', wording: '' }) // at least
})

test('no usable amount means no budget, never a guess', () => {
  assert.equal(interpretBudget(read(0, 0, 'a modest budget')), null)
  assert.equal(interpretBudget(read(-5, 0)), null)
  assert.equal(interpretBudget(read(Number.NaN, Number.NaN)), null)
  assert.equal(interpretBudget(read(5e12, 0)), null) // not plausible
})

test('a backwards range is put the right way round', () => {
  const b = interpretBudget(read(125000, 95000))!
  assert.equal(b.min, 95000)
  assert.equal(b.max, 125000)
})

test('a qualifier that is really a sentence is left out of the pill', () => {
  const long = 'inclusive of all fees, travel, research, design, development'
  assert.equal(interpretBudget(read(95000, 125000, long))!.qualifier, '')
  assert.equal(interpretBudget(read(95000, 125000, 'creative and strategy only, paid media separate'))!.qualifier, '')
  assert.equal(interpretBudget(read(95000, 125000, 'per year, 3 years'))!.qualifier, 'per year, 3 years')
  assert.equal(interpretBudget(read(95000, 125000, 'excludes media'))!.qualifier, 'excludes media')
})

test('whole dollars only; a long qualifier is cut', () => {
  assert.equal(interpretBudget(read(95000.4, 0))!.min, 95000)
  assert.ok(interpretBudget(read(1000, 0, 'x'.repeat(200)))!.qualifier.length <= 60)
})

test('typed amounts are understood', () => {
  const ok = (text: string) => parseUsdInput(text)
  assert.deepEqual(ok('95000'), { ok: true, value: 95000 })
  assert.deepEqual(ok('$95,000'), { ok: true, value: 95000 })
  assert.deepEqual(ok(' 95k '), { ok: true, value: 95000 })
  assert.deepEqual(ok('1.2M'), { ok: true, value: 1200000 })
  assert.deepEqual(ok('87.5k'), { ok: true, value: 87500 })
  assert.deepEqual(ok(''), { ok: true, value: null })
  assert.deepEqual(ok('$'), { ok: true, value: null })
  assert.deepEqual(ok('ninety'), { ok: false })
  assert.deepEqual(ok('-5'), { ok: false })
  assert.deepEqual(ok('0'), { ok: false })
  assert.deepEqual(ok('12k5'), { ok: false })
})

test('a budget typed the way people write it is understood', () => {
  const ok = (min: number | null, max: number | null) => ({ ok: true, min, max })
  assert.deepEqual(parseBudgetInput('95k'), ok(95000, 95000))
  assert.deepEqual(parseBudgetInput('$95,000'), ok(95000, 95000))
  assert.deepEqual(parseBudgetInput('$95K–$125K'), ok(95000, 125000))
  assert.deepEqual(parseBudgetInput('95k - 125k'), ok(95000, 125000))
  assert.deepEqual(parseBudgetInput('95k to 125k'), ok(95000, 125000))
  assert.deepEqual(parseBudgetInput('125k-95k'), ok(95000, 125000)) // backwards is put right
  assert.deepEqual(parseBudgetInput('Up to $100K'), ok(null, 100000))
  assert.deepEqual(parseBudgetInput('max 100k'), ok(null, 100000))
  assert.deepEqual(parseBudgetInput('$50K+'), ok(50000, null))
  assert.deepEqual(parseBudgetInput('at least 50k'), ok(50000, null))
  assert.deepEqual(parseBudgetInput('  '), ok(null, null))
  assert.deepEqual(parseBudgetInput('a lot'), { ok: false })
  assert.deepEqual(parseBudgetInput('up to lots'), { ok: false })
  assert.deepEqual(parseBudgetInput('95k to'), { ok: false })
  assert.deepEqual(parseBudgetInput('1-2-3'), { ok: false })
})

test('whatever the pill shows can be typed back in unchanged', () => {
  for (const [min, max] of [[95000, 125000], [60000, 60000], [null, 100000], [50000, null], [87500, 87500], [1250000, 1250000]] as const) {
    const shown = formatBudget(min, max)
    assert.deepEqual(parseBudgetInput(shown), { ok: true, min, max }, shown)
  }
})
