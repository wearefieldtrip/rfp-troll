import { daysUntilMoment } from './key-dates.ts'
import type { Moment } from './rfp-dates.ts'

export const PASS_REASONS = ['Budget', 'Timeline', 'Not a fit', 'Capacity', 'Scope', 'Other'] as const
export type PassReason = (typeof PASS_REASONS)[number]

export type Destination = 'questions' | 'proposal'

export type DestinationChoice = {
  destination: Destination
  /** Why it goes there, in a sentence for the confirmation modal. */
  why: string
}

type QuestionsInfo = { policy: string; deadline: Moment | null }

/**
 * Where "Move forward" goes (docs/specs/step-1-evaluate.md):
 * a questions deadline still ahead, or no deadline stated, goes to Questions;
 * questions not allowed, or a deadline that has passed, goes straight to Proposal.
 */
export function moveForwardDestination(q: QuestionsInfo, now: Date = new Date()): DestinationChoice {
  if (q.policy === 'not_allowed') {
    return { destination: 'proposal', why: "The RFP doesn't accept questions, so this goes straight to Proposal." }
  }
  if (q.policy === 'due' && q.deadline) {
    const passed = q.deadline.hasTime ? now.getTime() >= new Date(q.deadline.at).getTime() : daysUntilMoment(q.deadline, now) < 0
    if (passed) return { destination: 'proposal', why: 'The questions deadline has passed, so this goes straight to Proposal.' }
  }
  return { destination: 'questions', why: '' }
}

export const destinationLabel = (d: Destination) => (d === 'questions' ? 'Questions' : 'Proposal')
export const destinationStatus = (d: Destination) => (d === 'questions' ? 'Questions · Drafting' : 'Proposal · Drafting')
