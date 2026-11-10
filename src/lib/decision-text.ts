import { cleanBandLabel, MAX_TOTAL } from './rubric-structure.ts'
import { statusLabel } from './rfp-status.ts'

export type DecisionRow = {
  kind: string
  reason: string | null
  to_status: string
  decided_at: string
  score_total: number | null
  score_band: string | null
  profiles: { full_name: string | null; email: string } | null
}

export const decisionWhat = (d: Pick<DecisionRow, 'kind' | 'reason' | 'to_status'>) =>
  d.kind === 'pass' ? `Passed (${d.reason})` : d.kind === 'reopen' ? `Reopened to ${statusLabel(d.to_status)}` : `Moved forward to ${statusLabel(d.to_status)}`

export const decisionWho = (d: Pick<DecisionRow, 'profiles'>) => d.profiles?.full_name ?? d.profiles?.email ?? 'Someone'

export const decisionScore = (d: Pick<DecisionRow, 'score_total' | 'score_band'>) =>
  d.score_total != null ? `${d.score_total} / ${MAX_TOTAL} ${cleanBandLabel(d.score_band)}`.trimEnd() : ''

export const decisionWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
