import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dayCountLabel, daysUntil, daysUntilMoment, urgencyFor } from './key-dates.ts'
import { toMoment } from './rfp-dates.ts'

const at = (y: number, m: number, d: number, h = 14) => new Date(y, m - 1, d, h, 30)

test('days are counted on the calendar, not by the clock', () => {
  assert.equal(daysUntil('2027-03-12', at(2027, 3, 12)), 0)
  assert.equal(daysUntil('2027-03-12', at(2027, 3, 12, 23)), 0)
  assert.equal(daysUntil('2027-03-13', at(2027, 3, 12)), 1)
  assert.equal(daysUntil('2027-03-11', at(2027, 3, 12)), -1)
  assert.equal(daysUntil('2027-04-12', at(2027, 3, 12)), 31)
})

test('days still count correctly across the clock changes and the new year', () => {
  assert.equal(daysUntil('2027-03-15', at(2027, 3, 12)), 3)
  assert.equal(daysUntil('2027-11-08', at(2027, 11, 5)), 3)
  assert.equal(daysUntil('2028-01-02', at(2027, 12, 31)), 2)
})

test('a deadline is counted on the day written in the RFP, even late at night in its own zone', () => {
  // 11:30 PM Pacific on 15 January is already 16 January in UTC.
  const m = toMoment({ date: '2027-01-15', time: '23:30', timezone: 'America/Los_Angeles', wording: '' })!
  assert.equal(daysUntilMoment(m, at(2027, 1, 12)), 3)
})

test('the count reads naturally', () => {
  assert.equal(dayCountLabel(66), '66 days')
  assert.equal(dayCountLabel(1), '1 day')
  assert.equal(dayCountLabel(0), 'today')
  assert.equal(dayCountLabel(-1), '1 day ago')
  assert.equal(dayCountLabel(-3), '3 days ago')
})

test('urgency tightens as the date nears and stays red once it has passed', () => {
  assert.equal(urgencyFor(30), null)
  assert.equal(urgencyFor(15), null)
  assert.equal(urgencyFor(14), 'yellow')
  assert.equal(urgencyFor(8), 'yellow')
  assert.equal(urgencyFor(7), 'orange')
  assert.equal(urgencyFor(4), 'orange')
  assert.equal(urgencyFor(3), 'red')
  assert.equal(urgencyFor(0), 'red')
  assert.equal(urgencyFor(-5), 'red')
})
