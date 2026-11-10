import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nextStep } from './next-step.ts'
import type { Moment } from './rfp-dates.ts'

const day = (iso: string): Moment => ({ at: `${iso}T12:00:00.000Z`, hasTime: false, tz: null, text: '' })
const now = new Date(2026, 10, 10, 9, 0)

const base = { status: 'evaluate_ready', questions_policy: 'not_stated', questions: null, proposal: day('2027-01-15'), vendorSelection: null }

test('with no questions deadline the proposal date is next', () => {
  assert.equal(nextStep(base, now)?.label, 'Proposal due')
})

test('a questions deadline still ahead comes first', () => {
  const next = nextStep({ ...base, questions_policy: 'due', questions: day('2026-12-29') }, now)
  assert.equal(next?.label, 'Questions due')
})

test('a questions deadline that has passed falls back to the proposal date', () => {
  assert.equal(nextStep({ ...base, questions_policy: 'due', questions: day('2026-11-01') }, now)?.label, 'Proposal due')
})

test('once proposing, questions no longer matter', () => {
  assert.equal(nextStep({ ...base, status: 'proposal_drafting', questions_policy: 'due', questions: day('2026-12-29') }, now)?.label, 'Proposal due')
})

test('submitted shows the expected decision; closed shows nothing', () => {
  assert.equal(nextStep({ ...base, status: 'submitted_waiting', vendorSelection: day('2027-02-01') }, now)?.label, 'Decision expected')
  assert.equal(nextStep({ ...base, status: 'closed_passed' }, now), null)
})

test('no date at all is no next step', () => {
  assert.equal(nextStep({ ...base, proposal: null }, now), null)
})
