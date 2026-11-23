import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decisionScore, decisionWhat, decisionWho } from './decision-text.ts'

test('a pass names its reason', () => {
  assert.equal(decisionWhat({ kind: 'pass', reason: 'Budget', to_status: 'closed_passed' }), 'Passed (Budget)')
})

test('moving forward names the new status', () => {
  assert.equal(decisionWhat({ kind: 'move_forward', reason: null, to_status: 'questions_drafting' }), 'Moved forward to Questions · Drafting')
})

test('who falls back to email, then to someone', () => {
  assert.equal(decisionWho({ profiles: { full_name: null, email: 'a@b.co' } }), 'a@b.co')
  assert.equal(decisionWho({ profiles: null }), 'Someone')
})

test('score is empty when there was none', () => {
  assert.equal(decisionScore({ score_total: null, score_band: null }), '')
})

test('hand-offs after the proposal read plainly in the history', async () => {
  const { decisionWhat } = await import('./decision-text.ts')
  assert.equal(decisionWhat({ kind: 'submitted', reason: null, to_status: 'submitted_waiting' }), 'Marked as submitted')
  assert.equal(decisionWhat({ kind: 'won', reason: null, to_status: 'closed_won' }), 'Marked as won')
})
