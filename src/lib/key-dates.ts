/** A dated milestone read out of an RFP, as stored in rfps.key_dates. */
export type KeyDate = { label: string; date: string; time: string; evidence: string }

export const asKeyDates = (value: unknown): KeyDate[] => (Array.isArray(value) ? (value as KeyDate[]) : [])

export const formatLongDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })

/** Whole calendar days from `today` until a YYYY-MM-DD date. Negative when the date has passed. */
export function daysUntil(date: string, today: Date = new Date()): number {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const due = new Date(`${date}T00:00:00`)
  // Round, because a day is 23 or 25 hours long when the clocks change.
  return Math.round((due.getTime() - start.getTime()) / 86_400_000)
}
