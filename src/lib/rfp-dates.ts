// Dates read from an RFP: turned into a stored "moment" (instant, whether a time was given, and the time zone),
// and shown back with their time zone. See docs/specs/step-1-evaluate.md, "Dates and times".
// An identical copy lives in supabase/functions/sync-rfp-folder/ (functions deploy independently).
//
// Storage conventions:
//  - only a day given:        at = that day at 12:00 UTC, hasTime = false, tz = null. Only the day is shown.
//  - time and a zone given:   at = the real instant, hasTime = true, tz = an IANA zone such as America/New_York.
//  - time but no zone given:  at = the wall-clock time read as UTC, hasTime = true, tz = null. Shown as written,
//                             marked "time zone not stated".

export type DateFact = { date: string; time: string; timezone: string; wording: string }

export type Moment = { at: string; hasTime: boolean; tz: string | null; text: string }

export type QuestionsPolicy = 'due' | 'not_allowed' | 'not_stated'

// The round trip rejects days that don't exist, such as 2027-02-31, which Date.parse would quietly roll into March.
const isIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(y, m - 1, d))
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
const isClockTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

function isZone(value: string): boolean {
  if (!value) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

/** How far a zone is ahead of UTC at a given instant, in milliseconds. */
function offsetMs(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value)
  const wallAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return wallAsUtc - Math.floor(utcMs / 1000) * 1000
}

/** The instant at which the wall clock in `tz` reads the given date and time. */
function wallTimeToUtc(y: number, m: number, d: number, hh: number, mm: number, tz: string): number {
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  const first = guess - offsetMs(guess, tz)
  return guess - offsetMs(first, tz) // a second pass settles it across a daylight-saving change
}

/** Turns what the reader found into a stored moment. Null when there is no usable day. */
export function toMoment(fact: DateFact): Moment | null {
  if (!isIsoDate(fact.date)) return null
  const [y, m, d] = fact.date.split('-').map(Number)
  const text = fact.wording.trim()

  if (!isClockTime(fact.time)) {
    return { at: new Date(Date.UTC(y, m - 1, d, 12)).toISOString(), hasTime: false, tz: null, text }
  }
  const [hh, mm] = fact.time.split(':').map(Number)
  if (isZone(fact.timezone)) {
    return { at: new Date(wallTimeToUtc(y, m, d, hh, mm, fact.timezone)).toISOString(), hasTime: true, tz: fact.timezone, text }
  }
  return { at: new Date(Date.UTC(y, m - 1, d, hh, mm)).toISOString(), hasTime: true, tz: null, text }
}

/** The calendar day of a moment, as written in the RFP (in its own time zone). YYYY-MM-DD. */
export function calendarDate(m: Pick<Moment, 'at' | 'hasTime' | 'tz'>): string {
  return new Date(m.at).toLocaleDateString('en-CA', { timeZone: m.tz ?? 'UTC' })
}

const ZONE_LABELS: Record<string, string> = {
  'America/New_York': 'ET',
  'America/Chicago': 'CT',
  'America/Denver': 'MT',
  'America/Phoenix': 'MST',
  'America/Los_Angeles': 'PT',
  'America/Anchorage': 'AKT',
  'Pacific/Honolulu': 'HT',
  UTC: 'UTC',
}

function zoneLabel(tz: string, at: Date): string {
  if (ZONE_LABELS[tz]) return ZONE_LABELS[tz]
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(at).find((p) => p.type === 'timeZoneName')?.value ?? tz
}

/** "Jan 15, 2027, 5:00 PM ET", "Jan 15, 2027" for a day only, or "...5:00 PM (time zone not stated)". */
export function formatMoment(m: Pick<Moment, 'at' | 'hasTime' | 'tz'>): string {
  const at = new Date(m.at)
  const timeZone = m.tz ?? 'UTC'
  const day = at.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone })
  if (!m.hasTime) return day
  const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone })
  return `${day}, ${time} ${m.tz ? zoneLabel(m.tz, at) : '(time zone not stated)'}`
}

export type ReadDates = {
  proposal: DateFact
  questions: DateFact & { policy: 'due' | 'not_allowed' | 'not_stated' }
  vendorSelection: DateFact
}

export type InterpretedDates = {
  proposal: Moment | null
  questionsPolicy: QuestionsPolicy
  questions: Moment | null
  vendorSelection: Moment | null
}

/**
 * "Not allowed" and "Not stated" are different facts and are never merged: "not_allowed" is kept only when the RFP says
 * so, and "due" with no usable day falls back to "not_stated".
 */
export function interpretDates(read: ReadDates): InterpretedDates {
  const questions = toMoment(read.questions)
  const policy: QuestionsPolicy =
    read.questions.policy === 'not_allowed' ? 'not_allowed' : read.questions.policy === 'due' && questions ? 'due' : 'not_stated'

  return {
    proposal: toMoment(read.proposal),
    questionsPolicy: policy,
    questions: policy === 'due' ? questions : null,
    vendorSelection: toMoment(read.vendorSelection),
  }
}
