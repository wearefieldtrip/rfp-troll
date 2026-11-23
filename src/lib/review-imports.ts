// What the outcome editor on an imported RFP offers, and what each outcome does to its status.

/** Only a win is Closed · Won; everything else is Closed · Lost. */
export const outcomeStatus = (outcome: string) => (outcome === 'won' ? 'closed_won' : 'closed_lost')

export const OUTCOMES = [
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'no_response', label: 'No response' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'unknown', label: 'Unknown' },
] as const

export const STAGES = [
  { value: '', label: 'Not recorded' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'finalist', label: 'Finalist' },
  { value: 'pitched', label: 'Pitched' },
] as const
