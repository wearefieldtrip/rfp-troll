import type { Moment } from './rfp-dates.ts'

type Prefix = 'proposal_due' | 'questions_due' | 'vendor_selection'

type MomentRow = {
  proposal_due_at: string | null
  proposal_due_has_time: boolean
  proposal_due_tz: string | null
  proposal_due_text: string | null
  questions_due_at: string | null
  questions_due_has_time: boolean
  questions_due_tz: string | null
  questions_due_text: string | null
  vendor_selection_at: string | null
  vendor_selection_has_time: boolean
  vendor_selection_tz: string | null
  vendor_selection_text: string | null
}

/** Reads one of the three stored dates back off an RFP row. Null when the RFP has no such date. */
export function momentFrom(row: MomentRow, prefix: Prefix): Moment | null {
  const at = row[`${prefix}_at`]
  if (!at) return null
  return { at, hasTime: row[`${prefix}_has_time`], tz: row[`${prefix}_tz`], text: row[`${prefix}_text`] ?? '' }
}

/** The columns to write when a person types a day by hand: a day only, no time or zone, no quote. */
export function manualDayColumns(prefix: Prefix, day: string | null) {
  return {
    [`${prefix}_at`]: day ? new Date(`${day}T12:00:00Z`).toISOString() : null,
    [`${prefix}_has_time`]: false,
    [`${prefix}_tz`]: null,
    [`${prefix}_text`]: null,
  }
}
