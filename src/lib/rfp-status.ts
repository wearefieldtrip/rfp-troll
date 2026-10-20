export const RFP_STATUSES = ['evaluating', 'questions', 'proposal', 'submitted', 'won', 'lost', 'passed'] as const
export type RfpStatus = (typeof RFP_STATUSES)[number]

export const STATUS_LABELS: Record<RfpStatus, string> = {
  evaluating: 'Evaluating',
  questions: 'Questions',
  proposal: 'Proposal',
  submitted: 'Submitted',
  won: 'Won',
  lost: 'Lost',
  passed: 'Passed',
}

export const STATUS_VARIANTS: Record<RfpStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  evaluating: 'secondary',
  questions: 'secondary',
  proposal: 'default',
  submitted: 'default',
  won: 'default',
  lost: 'destructive',
  passed: 'outline',
}
