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
