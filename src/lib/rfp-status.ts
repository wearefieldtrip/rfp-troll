// Status is the step plus a word or two (docs/process-overview.md). Closed RFPs are Won, Lost or Passed.

export const STATUSES = {
  evaluate_reading: { label: 'Evaluate · Reading', step: 'evaluate' },
  evaluate_ready: { label: 'Evaluate · Ready for decision', step: 'evaluate' },
  questions_drafting: { label: 'Questions · Drafting', step: 'questions' },
  questions_sent: { label: 'Questions · Sent', step: 'questions' },
  questions_answers_in: { label: 'Questions · Answers in', step: 'questions' },
  proposal_drafting: { label: 'Proposal · Drafting', step: 'proposal' },
  proposal_in_review: { label: 'Proposal · In review', step: 'proposal' },
  submitted_waiting: { label: 'Submitted · Waiting', step: 'submitted' },
  submitted_shortlisted: { label: 'Submitted · Shortlisted', step: 'submitted' },
  closed_won: { label: 'Closed · Won', step: 'closed' },
  closed_lost: { label: 'Closed · Lost', step: 'closed' },
  closed_passed: { label: 'Closed · Passed', step: 'closed' },
} as const

export type RfpStatus = keyof typeof STATUSES
export type Step = (typeof STATUSES)[RfpStatus]['step']

export const STATUS_KEYS = Object.keys(STATUSES) as RfpStatus[]

/** A status read from the database. Anything unexpected falls back to the first state rather than crashing the page. */
export const asStatus = (value: string): RfpStatus => (value in STATUSES ? (value as RfpStatus) : 'evaluate_reading')

export const statusLabel = (status: string) => STATUSES[asStatus(status)].label
export const stepOf = (status: string): Step => STATUSES[asStatus(status)].step
export const isClosed = (status: string) => stepOf(status) === 'closed'

/** The statuses still being worked, which are the ones a person can decide on or pass. */
export const ACTIVE_STATUSES = STATUS_KEYS.filter((s) => !isClosed(s))

type Variant = 'default' | 'secondary' | 'outline' | 'destructive'

export const statusVariant = (status: string): Variant => {
  switch (asStatus(status)) {
    case 'closed_lost':
      return 'destructive'
    case 'closed_passed':
      return 'outline'
    case 'closed_won':
    case 'submitted_waiting':
    case 'submitted_shortlisted':
    case 'proposal_drafting':
    case 'proposal_in_review':
      return 'default'
    default:
      return 'secondary'
  }
}
