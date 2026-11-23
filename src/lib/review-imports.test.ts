import assert from 'node:assert/strict'
import { test } from 'node:test'
import { outcomeStatus } from './review-imports.ts'

test('only a win is Closed · Won', () => {
  assert.equal(outcomeStatus('won'), 'closed_won')
  for (const o of ['lost', 'no_response', 'qualified', 'unknown']) assert.equal(outcomeStatus(o), 'closed_lost')
})
