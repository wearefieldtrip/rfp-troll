import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildReview, ReviewInvalid } from './fit-review.ts'
import type { Band } from './rubric-structure.ts'

const bands: Band[] = [
  { min: 10, max: 12, label: 'Definite Go' },
  { min: 7, max: 9, label: 'Conditional Go' },
  { min: 4, max: 6, label: 'Likely No-Go' },
  { min: 0, max: 3, label: 'Definite No-Go' },
]

const dim = (key: string, score: number, extra: object = {}) => ({
  key,
  score,
  reason: `Reason for ${key}.`,
  evidence: [{ quote: `Quote for ${key}`, page: 2 }],
  ...extra,
})
const raw = (scores = [3, 1, 2, 1], extra: object = {}) => ({
  verdict: 'One sentence.',
  dimensions: ['A', 'B', 'C', 'D'].map((k, i) => dim(k, scores[i])),
  risks: ['r1', 'r2'],
  questions: ['q1?', 'q2?'],
  flags: [],
  auto_no_go: '',
  ...extra,
})

test('the total, maximum and band are computed, never taken from the model', () => {
  // The model even tries to supply its own, as it did in the real review that showed 7 / 10.
  const review = buildReview(raw([3, 1, 2, 1], { max_total: 10, decision_band: '7 – 9 · Conditional Go' }), bands)
  assert.equal(review.total, 7)
  assert.equal(review.max_total, 12)
  assert.equal(review.band.label, 'Conditional Go')
  assert.deepEqual(review.dimensions.map((d) => d.key), ['A', 'B', 'C', 'D'])
})

test('a dimension is never reported out of anything but the fixed scale', () => {
  const review = buildReview(raw([3, 1, 2, 1], { dimensions: raw().dimensions.map((d) => ({ ...d, max_score: 1 })) }), bands)
  assert.ok(review.dimensions.every((d) => !('max_score' in d)))
})

test('dimensions come back in A to D order whatever order the model used', () => {
  const shuffled = raw()
  shuffled.dimensions.reverse()
  assert.deepEqual(buildReview(shuffled, bands).dimensions.map((d) => d.key), ['A', 'B', 'C', 'D'])
})

test('a missing dimension, a duplicate, an extra and a bad score are all rejected', () => {
  assert.throws(() => buildReview(raw([3, 1, 2, 1], { dimensions: raw().dimensions.slice(0, 3) }), bands), ReviewInvalid)
  assert.throws(() => buildReview(raw([3, 1, 2, 1], { dimensions: [...raw().dimensions, dim('A', 2)] }), bands), /more than once/)
  assert.throws(() => buildReview(raw([3, 1, 2, 1], { dimensions: [...raw().dimensions, dim('E', 2)] }), bands), /not in the rubric/)
  assert.throws(() => buildReview(raw([4, 1, 2, 1]), bands), /outside 0 to 3/)
  assert.throws(() => buildReview(raw([3, -1, 2, 1]), bands), /outside 0 to 3/)
  assert.throws(() => buildReview(raw([3, 1.5, 2, 1]), bands), /outside 0 to 3/)
  assert.throws(() => buildReview(null, bands), ReviewInvalid)
})

test('every possible total gets a band', () => {
  assert.equal(buildReview(raw([3, 3, 3, 3]), bands).band.label, 'Definite Go')
  assert.equal(buildReview(raw([0, 0, 0, 0]), bands).band.label, 'Definite No-Go')
  assert.equal(buildReview(raw([3, 3, 3, 1]), bands).band.label, 'Definite Go') // 10
  assert.equal(buildReview(raw([3, 3, 2, 1]), bands).band.label, 'Conditional Go') // 9
  assert.throws(() => buildReview(raw(), [{ min: 0, max: 5, label: 'Only low' }]), /No decision band/)
})

test('the spec limits are applied', () => {
  const noisy = raw([3, 1, 2, 1], {
    risks: ['a', 'b', 'c', 'd', 'e'],
    questions: ['Q1?', 'q1', 'Q2?', 'Q3?', 'Q4?', 'Q5?', 'Q6?', 'Q7?', 'Q8?', 'Q9?', 'Q10?'],
    dimensions: raw().dimensions.map((d) => ({
      ...d,
      evidence: [{ quote: 'one', page: 1 }, { quote: 'two', page: 2 }, { quote: 'three', page: 3 }],
    })),
  })
  const review = buildReview(noisy, bands)
  assert.equal(review.risks.length, 3)
  assert.deepEqual(review.risks, ['a', 'b', 'c'])
  assert.equal(review.questions.length, 8)
  assert.equal(review.questions.filter((q) => q.toLowerCase().startsWith('q1')).length, 1) // duplicate dropped
  assert.ok(review.dimensions.every((d) => d.evidence.length === 2))
})

test('page 0 or a bad page becomes "no page"; empty quotes are dropped', () => {
  const review = buildReview(
    raw([3, 1, 2, 1], {
      dimensions: raw().dimensions.map((d) => ({
        ...d,
        evidence: [{ quote: 'real', page: 0 }, { quote: '   ', page: 4 }, { quote: 'fine', page: 4 }],
      })),
    }),
    bands,
  )
  assert.deepEqual(review.dimensions[0].evidence, [{ quote: 'real', page: null }, { quote: 'fine', page: 4 }])
})

test('flags and the automatic no-go reason pass through', () => {
  const review = buildReview(raw([0, 0, 1, 1], { flags: ['  The RFP is future-dated.  ', ''], auto_no_go: 'Free spec work is required.' }), bands)
  assert.deepEqual(review.flags, ['The RFP is future-dated.'])
  assert.equal(review.auto_no_go, 'Free spec work is required.')
})
