import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ACTIVE_STATUSES, asStatus, isClosed, STATUS_KEYS, statusLabel, stepOf } from './rfp-status.ts'

test('every status is the step plus a word or two', () => {
  assert.equal(statusLabel('evaluate_reading'), 'Evaluate · Reading')
  assert.equal(statusLabel('evaluate_ready'), 'Evaluate · Ready for decision')
  assert.equal(statusLabel('questions_answers_in'), 'Questions · Answers in')
  assert.equal(statusLabel('closed_passed'), 'Closed · Passed')
  assert.equal(STATUS_KEYS.length, 12)
})

test('the step of each status', () => {
  assert.equal(stepOf('evaluate_ready'), 'evaluate')
  assert.equal(stepOf('questions_sent'), 'questions')
  assert.equal(stepOf('proposal_in_review'), 'proposal')
  assert.equal(stepOf('submitted_shortlisted'), 'submitted')
  assert.equal(stepOf('closed_won'), 'closed')
})

test('only the three closed statuses are closed', () => {
  assert.deepEqual(STATUS_KEYS.filter(isClosed), ['closed_won', 'closed_lost', 'closed_passed'])
  assert.equal(ACTIVE_STATUSES.length, 9)
  assert.ok(ACTIVE_STATUSES.every((s) => !isClosed(s)))
})

test('an unknown status does not crash the page', () => {
  assert.equal(asStatus('evaluating'), 'evaluate_reading') // an old value
  assert.equal(statusLabel('nonsense'), 'Evaluate · Reading')
})
