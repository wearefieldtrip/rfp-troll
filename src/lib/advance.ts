// The hand-offs after the proposal is built (docs/specs/step-3-proposal.md, "After the proposal"). Each moves the RFP's
// status and is recorded in the decision history. The database function `advance_rfp` enforces the same moves.

export type AdvanceAction = 'ready_for_review' | 'back_to_drafting' | 'submitted' | 'shortlisted' | 'won' | 'lost'

export type AdvanceInfo = {
  button: string
  title: string
  /** What happens, one line each, for the confirmation modal. */
  will: string[]
  to: string
}

export const ADVANCE: Record<AdvanceAction, AdvanceInfo> = {
  ready_for_review: { button: 'Ready for review', title: 'Mark the proposal ready for review?', will: ['Change the status to Proposal · In review', 'Record this in the history'], to: 'proposal_in_review' },
  back_to_drafting: { button: 'Back to drafting', title: 'Send the proposal back to drafting?', will: ['Change the status to Proposal · Drafting', 'Record this in the history'], to: 'proposal_drafting' },
  submitted: { button: 'Mark as submitted', title: 'Mark the proposal as submitted?', will: ['Change the status to Submitted · Waiting', 'Record this in the history'], to: 'submitted_waiting' },
  shortlisted: { button: 'Shortlisted', title: 'Mark as shortlisted?', will: ['Change the status to Submitted · Shortlisted', 'Record this in the history'], to: 'submitted_shortlisted' },
  won: { button: 'Won', title: 'Mark this RFP as won?', will: ['Change the status to Closed · Won', 'Keep it in the past RFPs the team compares against', 'Record this in the history'], to: 'closed_won' },
  lost: { button: 'Lost', title: 'Mark this RFP as lost?', will: ['Change the status to Closed · Lost', 'Keep it in the past RFPs the team compares against', 'Record this in the history'], to: 'closed_lost' },
}

/** The actions open from a status, the main one first. Empty when there is nothing to hand off. */
export function actionsFor(status: string): AdvanceAction[] {
  switch (status) {
    case 'proposal_drafting':
      return ['ready_for_review', 'submitted']
    case 'proposal_in_review':
      return ['submitted', 'back_to_drafting']
    case 'submitted_waiting':
      return ['shortlisted', 'won', 'lost']
    case 'submitted_shortlisted':
      return ['won', 'lost']
    default:
      return []
  }
}

/** What the card above the buttons says for a status. */
export function advanceCopy(status: string): { title: string; text: string } | null {
  switch (status) {
    case 'proposal_drafting':
      return { title: 'When the proposal is ready', text: 'Hand it to review. If it has already gone out, mark it as submitted.' }
    case 'proposal_in_review':
      return { title: 'In review', text: 'Check the proposal against the requirements list, then mark it as submitted, or send it back to drafting.' }
    case 'submitted_waiting':
      return { title: 'Waiting to hear back', text: 'Update the RFP when the issuer replies.' }
    case 'submitted_shortlisted':
      return { title: 'Shortlisted', text: 'Mark the result when the issuer decides.' }
    default:
      return null
  }
}
