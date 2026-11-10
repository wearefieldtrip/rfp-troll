import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calendarDate, formatMoment, interpretDates, toMoment, type DateFact } from './rfp-dates.ts'

const fact = (date: string, time = '', timezone = '', wording = ''): DateFact => ({ date, time, timezone, wording })
const none = fact('')

test('a day, a time and a zone become a real instant', () => {
  const winter = toMoment(fact('2027-01-15', '17:00', 'America/New_York', 'January 15, 2027 at 5:00 PM ET'))!
  assert.equal(winter.at, '2027-01-15T22:00:00.000Z') // 5 PM EST is 22:00 UTC
  assert.equal(winter.hasTime, true)
  assert.equal(winter.tz, 'America/New_York')
  assert.equal(winter.text, 'January 15, 2027 at 5:00 PM ET')

  const summer = toMoment(fact('2027-07-15', '17:00', 'America/New_York'))!
  assert.equal(summer.at, '2027-07-15T21:00:00.000Z') // 5 PM EDT is 21:00 UTC
  assert.equal(toMoment(fact('2027-01-15', '12:00', 'America/Chicago'))!.at, '2027-01-15T18:00:00.000Z')
  assert.equal(toMoment(fact('2027-01-15', '09:00', 'America/Los_Angeles'))!.at, '2027-01-15T17:00:00.000Z')
})

test('the daylight-saving change days resolve to the right instant', () => {
  // US clocks spring forward on 14 March 2027 and fall back on 7 November 2027.
  assert.equal(toMoment(fact('2027-03-14', '12:00', 'America/New_York'))!.at, '2027-03-14T16:00:00.000Z') // already EDT
  assert.equal(toMoment(fact('2027-03-13', '12:00', 'America/New_York'))!.at, '2027-03-13T17:00:00.000Z') // still EST
  assert.equal(toMoment(fact('2027-11-07', '12:00', 'America/New_York'))!.at, '2027-11-07T17:00:00.000Z') // back to EST
})

test('a day with no time is shown as a day only, whatever the viewer time zone', () => {
  const m = toMoment(fact('2027-01-15'))!
  assert.equal(m.hasTime, false)
  assert.equal(m.tz, null)
  assert.equal(m.at, '2027-01-15T12:00:00.000Z')
  assert.equal(formatMoment(m), 'Jan 15, 2027')
  assert.equal(calendarDate(m), '2027-01-15')
})

test('a time with no zone is shown as written and marked as having no zone', () => {
  const m = toMoment(fact('2027-01-15', '17:00'))!
  assert.equal(m.hasTime, true)
  assert.equal(m.tz, null)
  assert.equal(formatMoment(m), 'Jan 15, 2027, 5:00 PM (time zone not stated)')
})

test('a stated zone is shown with its short name', () => {
  assert.equal(formatMoment(toMoment(fact('2027-01-15', '17:00', 'America/New_York'))!), 'Jan 15, 2027, 5:00 PM ET')
  assert.equal(formatMoment(toMoment(fact('2027-01-15', '12:00', 'America/Chicago'))!), 'Jan 15, 2027, 12:00 PM CT')
  assert.equal(formatMoment(toMoment(fact('2027-01-15', '09:30', 'America/Los_Angeles'))!), 'Jan 15, 2027, 9:30 AM PT')
})

test('the calendar day is the day in the RFP, not the day in UTC', () => {
  // 11:30 PM Pacific on 15 January is already 16 January in UTC.
  const m = toMoment(fact('2027-01-15', '23:30', 'America/Los_Angeles'))!
  assert.equal(m.at, '2027-01-16T07:30:00.000Z')
  assert.equal(calendarDate(m), '2027-01-15')
  assert.equal(formatMoment(m), 'Jan 15, 2027, 11:30 PM PT')
})

test('bad input degrades safely instead of guessing', () => {
  assert.equal(toMoment(fact('')), null)
  assert.equal(toMoment(fact('January 15')), null)
  assert.equal(toMoment(fact('2027-02-31')), null)
  assert.equal(toMoment(fact('2027-13-01')), null)
  assert.equal(toMoment(fact('2027-01-15', '25:00', 'America/New_York'))!.hasTime, false) // bad time: keep the day
  assert.equal(toMoment(fact('2027-01-15', '5:00 PM', 'America/New_York'))!.hasTime, false) // not 24-hour: keep the day
  assert.equal(toMoment(fact('2027-01-15', '17:00', 'Mars/Olympus'))!.tz, null) // unknown zone: treated as not stated
})

test('not allowed and not stated are never merged', () => {
  const base = { proposal: fact('2027-01-15'), vendorSelection: none }
  assert.equal(interpretDates({ ...base, questions: { ...none, policy: 'not_allowed', wording: 'No questions will be accepted.' } }).questionsPolicy, 'not_allowed')
  assert.equal(interpretDates({ ...base, questions: { ...none, policy: 'not_stated' } }).questionsPolicy, 'not_stated')
  assert.equal(interpretDates({ ...base, questions: { ...fact('2026-12-29', '17:00', 'America/New_York'), policy: 'due' } }).questionsPolicy, 'due')
  // "due" without a usable day cannot be shown as due
  assert.equal(interpretDates({ ...base, questions: { ...none, policy: 'due' } }).questionsPolicy, 'not_stated')
})

test('a "not allowed" RFP never carries a questions date', () => {
  const r = interpretDates({
    proposal: fact('2027-01-15'),
    vendorSelection: none,
    questions: { ...fact('2026-12-29'), policy: 'not_allowed' },
  })
  assert.equal(r.questionsPolicy, 'not_allowed')
  assert.equal(r.questions, null)
})

test('each date is independent', () => {
  const r = interpretDates({
    proposal: fact('2027-01-15', '17:00', 'America/New_York'),
    questions: { ...none, policy: 'not_stated' },
    vendorSelection: fact('2027-02-12'),
  })
  assert.equal(formatMoment(r.proposal!), 'Jan 15, 2027, 5:00 PM ET')
  assert.equal(r.questions, null)
  assert.equal(formatMoment(r.vendorSelection!), 'Feb 12, 2027')
  assert.equal(interpretDates({ proposal: none, questions: { ...none, policy: 'not_stated' }, vendorSelection: none }).proposal, null)
})
