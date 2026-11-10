import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toReviewView } from './review-result.ts'

// The shape of the first real review, which let the model choose each maximum: 3/3, 1/1, 2/3, 1/3 and "out of 10".
const firstRealReview = {
  summary: 'Strong mission fit, but a tight budget.',
  extracted: { budget: '$95K–$125K', project_timeline: 'March to July 2027', scope_summary: 'Brand and website.' },
  dimensions: [
    { title: 'Mission and Segment Alignment', score: 3, max_score: 3, rationale: 'Clear mission.', evidence: ['works to improve youth mental health'] },
    { title: 'Budget and Value Health', score: 1, max_score: 1, rationale: 'Tight budget.', evidence: [] },
    { title: 'Scope and Relationship Boundaries', score: 2, max_score: 3, rationale: 'Mostly clear.', evidence: [] },
    { title: 'Timeline and Capacity Feasibility', score: 1, max_score: 3, rationale: 'Compressed.', evidence: [] },
  ],
  auto_no_go: { triggered: false, reason: '' },
  decision_band: '7 – 9 · Conditional Go',
  risks: ['r1'],
  missing_information: ['m1'],
  suggested_questions: ['q1?'],
  max_total: 10,
}

test('an older review is shown on the fixed scale, not the maximum the model chose', () => {
  const view = toReviewView(firstRealReview, 7, '7 – 9 · Conditional Go')
  assert.equal(view.total, 7)
  assert.equal(view.max, 12)
  assert.equal(view.band, 'Conditional Go')
  assert.deepEqual(view.dimensions.map((d) => `${d.score}/${d.max}`), ['3/3', '1/3', '2/3', '1/3'])
  assert.equal(view.dimensions[0].evidence[0].page, null)
  assert.equal(view.facts.length, 3)
  assert.deepEqual(view.notStated, ['m1'])
  assert.equal(view.autoNoGo, '')
})

test('an older review with the automatic no-go keeps its reason', () => {
  const view = toReviewView({ ...firstRealReview, auto_no_go: { triggered: true, reason: 'Free spec work.' } }, 4, null)
  assert.equal(view.autoNoGo, 'Free spec work.')
})

test('a current review passes through with named dimensions and page numbers', () => {
  const view = toReviewView(
    {
      version: 2,
      verdict: 'One sentence.',
      total: 9,
      max_total: 12,
      band: { min: 7, max: 9, label: 'Conditional Go' },
      dimensions: [
        { key: 'A', score: 3, reason: 'r', evidence: [{ quote: 'q', page: 4 }] },
        { key: 'B', score: 2, reason: 'r', evidence: [] },
        { key: 'C', score: 2, reason: 'r', evidence: [] },
        { key: 'D', score: 2, reason: 'r', evidence: [] },
      ],
      risks: [],
      questions: ['q?'],
      flags: ['Check me'],
      auto_no_go: '',
    },
    9,
    'Conditional Go',
  )
  assert.equal(view.max, 12)
  assert.equal(view.dimensions[1].title, 'B. Budget and value')
  assert.equal(view.dimensions[0].evidence[0].page, 4)
  assert.deepEqual(view.flags, ['Check me'])
  assert.equal(view.facts.length, 0)
})

test('an empty or missing result does not crash the page', () => {
  assert.doesNotThrow(() => toReviewView(null, null, null))
  assert.equal(toReviewView({}, 5, 'Likely No-Go').band, 'Likely No-Go')
})
