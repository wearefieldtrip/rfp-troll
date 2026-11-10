import assert from 'node:assert/strict'
import { test } from 'node:test'
import { destinationLabel, destinationStatus, moveForwardDestination, PASS_REASONS } from './decisions.ts'
import { toMoment } from './rfp-dates.ts'

const deadline = (date: string, time = '', timezone = '') => toMoment({ date, time, timezone, wording: '' })

const noon = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0)

test('a questions deadline still ahead goes to Questions', () => {
  const r = moveForwardDestination({ policy: 'due', deadline: deadline('2026-12-29', '17:00', 'America/New_York') }, noon(2026, 11, 10))
  assert.equal(r.destination, 'questions')
})

test('a deadline that has passed goes straight to Proposal', () => {
  const r = moveForwardDestination({ policy: 'due', deadline: deadline('2026-12-29', '17:00', 'America/New_York') }, noon(2027, 1, 3))
  assert.equal(r.destination, 'proposal')
  assert.match(r.why, /deadline has passed/)
})

test('the deadline day itself still counts as ahead, until the stated time', () => {
  const day = deadline('2026-12-29') // a day with no time
  assert.equal(moveForwardDestination({ policy: 'due', deadline: day }, noon(2026, 12, 29)).destination, 'questions')
  assert.equal(moveForwardDestination({ policy: 'due', deadline: day }, noon(2026, 12, 30)).destination, 'proposal')

  const timed = deadline('2026-12-29', '17:00', 'America/New_York') // 5 PM ET = 22:00 UTC
  assert.equal(moveForwardDestination({ policy: 'due', deadline: timed }, new Date('2026-12-29T21:59:00Z')).destination, 'questions')
  assert.equal(moveForwardDestination({ policy: 'due', deadline: timed }, new Date('2026-12-29T22:00:00Z')).destination, 'proposal')
})

test('questions not allowed goes straight to Proposal', () => {
  const r = moveForwardDestination({ policy: 'not_allowed', deadline: null })
  assert.equal(r.destination, 'proposal')
  assert.match(r.why, /doesn't accept questions/)
})

test('a deadline that is not stated goes to Questions', () => {
  assert.equal(moveForwardDestination({ policy: 'not_stated', deadline: null }).destination, 'questions')
})

test('labels and the fixed list of pass reasons', () => {
  assert.equal(destinationLabel('questions'), 'Questions')
  assert.equal(destinationStatus('proposal'), 'Proposal · Drafting')
  assert.deepEqual([...PASS_REASONS], ['Budget', 'Timeline', 'Not a fit', 'Capacity', 'Scope', 'Other'])
})
