/** A dated milestone read out of an RFP, as stored in rfps.key_dates. */
export type KeyDate = { label: string; date: string; time: string; evidence: string }

export const asKeyDates = (value: unknown): KeyDate[] => (Array.isArray(value) ? (value as KeyDate[]) : [])

export const formatLongDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
