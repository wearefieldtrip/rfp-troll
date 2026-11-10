import { daysUntilMoment } from './key-dates.ts'
import { stepOf } from './rfp-status.ts'
import type { Moment } from './rfp-dates.ts'

export type NextStep = { label: string; moment: Moment }

type Input = {
  status: string
  questions_policy: string
  questions: Moment | null
  proposal: Moment | null
  vendorSelection: Moment | null
}

/**
 * The next date that needs someone: the questions deadline while it is still ahead, then the proposal deadline,
 * then (once submitted) the expected decision. Null for a closed RFP or when the RFP gives no such date.
 */
export function nextStep(rfp: Input, now: Date = new Date()): NextStep | null {
  const step = stepOf(rfp.status)
  if (step === 'closed') return null
  if (step === 'submitted') return rfp.vendorSelection ? { label: 'Decision expected', moment: rfp.vendorSelection } : null

  const questionsOpen = step === 'evaluate' || rfp.status === 'questions_drafting'
  if (questionsOpen && rfp.questions_policy === 'due' && rfp.questions && daysUntilMoment(rfp.questions, now) >= 0) {
    return { label: 'Questions due', moment: rfp.questions }
  }
  return rfp.proposal ? { label: 'Proposal due', moment: rfp.proposal } : null
}
