import { calendarDate, type Moment } from './rfp-dates.ts'

/** Whole calendar days from `today` until a YYYY-MM-DD date. Negative when the date has passed. */
export function daysUntil(date: string, today: Date = new Date()): number {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const due = new Date(`${date}T00:00:00`)
  // Round, because a day is 23 or 25 hours long when the clocks change.
  return Math.round((due.getTime() - start.getTime()) / 86_400_000)
}

/** Days from today to a stored date, counted on the calendar day written in the RFP (in its own time zone). */
export const daysUntilMoment = (m: Pick<Moment, 'at' | 'hasTime' | 'tz'>, today: Date = new Date()) => daysUntil(calendarDate(m), today)

/** "66 days", "1 day", "today", "3 days ago". */
export function dayCountLabel(days: number): string {
  if (days === 0) return 'today'
  const n = Math.abs(days)
  const unit = n === 1 ? 'day' : 'days'
  return days > 0 ? `${n} ${unit}` : `${n} ${unit} ago`
}

export type Urgency = 'yellow' | 'orange' | 'red' | null

/** How close a deadline is: 14 days or fewer is yellow, 7 or fewer orange, 3 or fewer (or passed) red. */
export function urgencyFor(days: number): Urgency {
  return days <= 3 ? 'red' : days <= 7 ? 'orange' : days <= 14 ? 'yellow' : null
}
