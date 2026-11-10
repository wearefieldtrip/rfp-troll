import assert from 'node:assert/strict'
import { test } from 'node:test'
import { manualDayColumns, momentFrom } from './moment-columns.ts'
import { calendarDate, formatMoment } from './rfp-dates.ts'

const row = {
  proposal_due_at: '2027-01-15T22:00:00+00:00',
  proposal_due_has_time: true,
  proposal_due_tz: 'America/New_York',
  proposal_due_text: 'January 15, 2027 at 5:00 PM ET',
  questions_due_at: null,
  questions_due_has_time: false,
  questions_due_tz: null,
  questions_due_text: null,
  vendor_selection_at: '2027-02-12T12:00:00+00:00',
  vendor_selection_has_time: false,
  vendor_selection_tz: null,
  vendor_selection_text: null,
}

test('a stored date reads back the way it was found in the RFP', () => {
  const m = momentFrom(row, 'proposal_due')!
  assert.equal(formatMoment(m), 'Jan 15, 2027, 5:00 PM ET')
  assert.equal(m.text, 'January 15, 2027 at 5:00 PM ET')
  assert.equal(calendarDate(m), '2027-01-15')
})

test('a day-only date shows just the day, and a missing date is null', () => {
  assert.equal(formatMoment(momentFrom(row, 'vendor_selection')!), 'Feb 12, 2027')
  assert.equal(momentFrom(row, 'questions_due'), null)
})

test('a day typed by hand is stored as a day only, with no time, zone or quote', () => {
  const cols = manualDayColumns('proposal_due', '2027-01-22')
  assert.equal(cols.proposal_due_at, '2027-01-22T12:00:00.000Z')
  assert.equal(cols.proposal_due_has_time, false)
  assert.equal(cols.proposal_due_tz, null)
  assert.equal(cols.proposal_due_text, null)
  const back = momentFrom({ ...row, ...cols } as typeof row, 'proposal_due')!
  assert.equal(formatMoment(back), 'Jan 22, 2027')
})

test('clearing the day clears the date', () => {
  assert.equal(manualDayColumns('proposal_due', null).proposal_due_at, null)
})
