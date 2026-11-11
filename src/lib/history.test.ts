import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildHistory, type HistoryInput } from './history.ts'

const people = [{ id: 'u1', full_name: 'Jane P', email: 'jane@x.com' }, { id: 'u2', full_name: null, email: 'sam@x.com' }]

const base = (): HistoryInput => ({
  rfp: { created_at: '2026-11-10T15:00:00Z', created_by: 'u1', questions_sent_on: null, questions_sent_count: null },
  reviews: [],
  decisions: [],
  answers: [],
  people,
})

test('a new RFP has one entry: who added it', () => {
  const h = buildHistory(base())
  assert.deepEqual(h.map((e) => [e.title, e.who]), [['RFP added', 'Jane P']])
})

test('everything is listed newest first, with who, score and notes', () => {
  const input = base()
  input.reviews = [{ id: 'r1', status: 'complete', created_at: '2026-11-10T15:01:00Z', completed_at: '2026-11-10T15:02:00Z', created_by: 'u1', total_score: 7, decision_band: '7 – 9 · Conditional Go' }]
  input.decisions = [
    { id: 'd1', kind: 'move_forward', reason: null, to_status: 'questions_drafting', decided_at: '2026-11-10T16:00:00Z', score_total: 7, score_band: 'Conditional Go', profiles: { full_name: null, email: 'sam@x.com' }, note: null },
    { id: 'd2', kind: 'pass', reason: 'Budget', to_status: 'closed_passed', decided_at: '2026-11-12T16:00:00Z', score_total: 9, score_band: 'Conditional Go', profiles: null, note: 'Too small' },
  ]
  const h = buildHistory(input)
  assert.deepEqual(h.map((e) => e.title), ['Passed (Budget)', 'Moved forward to Questions · Drafting', 'Fit review run', 'RFP added'])
  assert.equal(h[0].note, 'Too small')
  assert.equal(h[0].who, 'Someone')
  assert.equal(h[1].who, 'sam@x.com')
  assert.equal(h[2].detail, '7 / 12 Conditional Go')
})

test('a review made from answers is a re-score; running and failed reviews are left out', () => {
  const input = base()
  input.reviews = [
    { id: 'r1', status: 'complete', created_at: '2026-11-10T15:01:00Z', completed_at: null, created_by: 'u1', total_score: 7, decision_band: 'Conditional Go' },
    { id: 'r2', status: 'complete', created_at: '2026-11-13T10:00:00Z', completed_at: null, created_by: 'u2', total_score: 9, decision_band: 'Conditional Go' },
    { id: 'r3', status: 'failed', created_at: '2026-11-11T10:00:00Z', completed_at: null, created_by: 'u1', total_score: null, decision_band: null },
    { id: 'r4', status: 'running', created_at: '2026-11-11T11:00:00Z', completed_at: null, created_by: 'u1', total_score: null, decision_band: null },
  ]
  input.answers = [{ id: 'a1', created_at: '2026-11-13T09:59:00Z', created_by: 'u2', received_on: '2026-11-12', status: 'done', review_id: 'r2', file_name: 'a.pdf' }]
  const h = buildHistory(input)
  assert.deepEqual(h.map((e) => e.title), ['Re-scored after answers', 'Answers added', 'Fit review run', 'RFP added'])
  assert.equal(h[1].detail, 'Received Nov 12, 2026')
})

test('marking sent shows the day and the count, with no person', () => {
  const input = base()
  input.rfp.questions_sent_on = '2026-11-11'
  input.rfp.questions_sent_count = 1
  const sent = buildHistory(input).find((e) => e.id === 'sent')
  assert.equal(sent?.who, null)
  assert.equal(sent?.dateOnly, true)
  assert.equal(sent?.detail, '1 question')
})

test('a failed batch of answers says so', () => {
  const input = base()
  input.answers = [{ id: 'a1', created_at: '2026-11-13T09:59:00Z', created_by: 'nobody', received_on: '2026-11-12', status: 'failed', review_id: null, file_name: null }]
  const entry = buildHistory(input).find((e) => e.id === 'answers-a1')
  assert.equal(entry?.title, 'Answers added, reading failed')
  assert.equal(entry?.who, null)
})
