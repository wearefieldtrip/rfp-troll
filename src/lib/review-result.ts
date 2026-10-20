/** Shape of rfp_reviews.result, as written by the review-rfp Edge Function. */
export type ReviewResult = {
  summary: string
  extracted: {
    client_name: string
    proposal_due_date: string
    budget: string
    project_timeline: string
    scope_summary: string
  }
  dimensions: { title: string; score: number; max_score: number; rationale: string; evidence: string[] }[]
  auto_no_go: { triggered: boolean; reason: string }
  decision_band: string
  risks: string[]
  missing_information: string[]
  suggested_questions: string[]
  max_total: number
}
