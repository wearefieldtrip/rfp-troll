import assert from 'node:assert/strict'
import { test } from 'node:test'
import { actionsFor, advanceCopy, ADVANCE } from './advance.ts'
import { STATUSES } from './rfp-status.ts'

test('each status offers the right hand-offs, main one first', () => {
  assert.deepEqual(actionsFor('proposal_drafting'), ['submitted'])
  assert.deepEqual(actionsFor('proposal_in_review'), ['submitted', 'back_to_drafting'])
  assert.deepEqual(actionsFor('submitted_waiting'), ['shortlisted', 'won', 'lost'])
  assert.deepEqual(actionsFor('submitted_shortlisted'), ['won', 'lost'])
  assert.deepEqual(actionsFor('evaluate_ready'), [])
  assert.deepEqual(actionsFor('closed_won'), [])
})

test('every action leads to a real status and every active status has a card', () => {
  for (const info of Object.values(ADVANCE)) assert.ok(info.to in STATUSES)
  for (const s of ['proposal_drafting', 'proposal_in_review', 'submitted_waiting', 'submitted_shortlisted']) assert.ok(advanceCopy(s))
  assert.equal(advanceCopy('closed_won'), null)
})
