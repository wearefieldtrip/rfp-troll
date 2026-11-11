// What the Review imports list says about each imported RFP, and what confirming one changes. Pure, so it is tested.

export type Issue = { field: string; value: string; reason: string }

export type ImportedForReview = {
  import_issues: unknown
  outcome: string | null
  proposal_link_status: string | null
  import_reviewed: boolean
  rfp_tags: { confirmed: boolean; source: string }[]
}

const asIssues = (value: unknown): Issue[] =>
  Array.isArray(value) ? value.filter((i): i is Issue => typeof i === 'object' && i !== null && typeof (i as Issue).field === 'string') : []

const SHORT: Record<string, string> = {
  'Client Type 1': 'client type',
  'Client Type 2': 'sector',
  'Project Type': 'project type',
  'Document Type': 'document type',
  State: 'state',
  'Submission Year': 'year',
}

const LINK_PROBLEMS: Record<string, string> = {
  no_access: "Proposal can't be opened",
  not_a_doc: "Proposal link isn't a Google Doc",
  no_link: 'No proposal link',
}

/** Short reasons an imported RFP still needs a person. Empty once it is reviewed, or when nothing is wrong. */
export function reviewReasons(r: ImportedForReview): string[] {
  if (r.import_reviewed) return []
  const reasons: string[] = []

  for (const issue of asIssues(r.import_issues)) {
    if (issue.field === 'Did We Win?') continue
    const name = SHORT[issue.field] ?? issue.field
    reasons.push(issue.value.trim() ? `${name} "${issue.value}" has no match` : `No ${name}`)
  }
  if (r.outcome === 'unknown') reasons.push('Outcome unclear')

  if (r.proposal_link_status === null) reasons.push('Proposal not linked yet')
  else if (LINK_PROBLEMS[r.proposal_link_status]) reasons.push(LINK_PROBLEMS[r.proposal_link_status])

  const guesses = r.rfp_tags.filter((t) => t.source === 'ai' && !t.confirmed).length
  if (guesses > 0) reasons.push(`${guesses} AI ${guesses === 1 ? 'tag' : 'tags'} to confirm`)
  return reasons
}

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
