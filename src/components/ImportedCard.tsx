import { ExternalLinkIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Database } from '@/lib/database.types'
import { OUTCOME_LABELS, STAGE_LABELS } from '@/lib/import-view'
import { LINK_STATUS_LABELS, type LinkStatus } from '@/lib/proposal-link'

type Rfp = Database['public']['Tables']['rfps']['Row']

type ImportData = {
  tracker_row?: number
  link_url?: string | null
  project_type?: string
  state?: string
  document_type?: string
  case_studies?: string[]
  prepared_by?: string
  response?: string
}

type Issue = { field: string; value: string; reason: string }

const asRecord = (value: unknown): ImportData => (value && typeof value === 'object' && !Array.isArray(value) ? (value as ImportData) : {})
const asIssues = (value: unknown): Issue[] => (Array.isArray(value) ? (value as Issue[]) : [])

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  )
}

/** What a past RFP imported from the tracker looks like: its outcome and the details the tracker holds. */
export function ImportedCard({ rfp }: { rfp: Rfp }) {
  const data = asRecord(rfp.import_data)
  const issues = asIssues(rfp.import_issues)
  const outcome = rfp.outcome ? (OUTCOME_LABELS[rfp.outcome] ?? rfp.outcome) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>From the RFP tracker</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <dl className="grid grid-cols-[9rem_1fr] gap-y-2">
          {outcome && <Fact label="Outcome">{outcome}</Fact>}
          {rfp.furthest_stage && <Fact label="Furthest stage">{STAGE_LABELS[rfp.furthest_stage] ?? rfp.furthest_stage}</Fact>}
          {rfp.closed_reason && <Fact label="Reason">{rfp.closed_reason}</Fact>}
          {rfp.outcome_notes && <Fact label="Note">{rfp.outcome_notes}</Fact>}
          {rfp.submission_year && <Fact label="Submitted">{rfp.submission_year}</Fact>}
          {data.project_type && <Fact label="Project type">{data.project_type}</Fact>}
          {data.document_type && <Fact label="Document">{data.document_type}</Fact>}
          {data.state && <Fact label="State">{data.state}</Fact>}
          {data.case_studies && data.case_studies.length > 0 && <Fact label="Case studies used">{data.case_studies.join(', ')}</Fact>}
          {data.prepared_by && <Fact label="Prepared by">{data.prepared_by}</Fact>}
          {(rfp.proposal_doc_id || data.link_url) && (
            <Fact label="Proposal">
              <span className="flex flex-wrap gap-x-4 gap-y-1">
                <a
                  href={rfp.proposal_doc_id ? `https://docs.google.com/document/d/${rfp.proposal_doc_id}/edit` : data.link_url!}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline underline-offset-4"
                >
                  Open the proposal Doc
                  <ExternalLinkIcon className="size-3" aria-hidden />
                </a>
                {rfp.proposal_pdf_id && (
                  <a href={`https://drive.google.com/file/d/${rfp.proposal_pdf_id}/view`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
                    PDF
                    <ExternalLinkIcon className="size-3" aria-hidden />
                  </a>
                )}
              </span>
              {rfp.proposal_link_status && rfp.proposal_link_status !== 'linked' && (
                <span className="mt-1 block text-destructive">
                  {LINK_STATUS_LABELS[rfp.proposal_link_status as LinkStatus] ?? rfp.proposal_link_status}. The app can't read this proposal until it is shared with the service account or moved into the shared drive.
                </span>
              )}
            </Fact>
          )}
        </dl>
        {issues.length > 0 && (
          <div className="space-y-1">
            <p className="font-medium">Needs review</p>
            <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
              {issues.map((i, n) => (
                <li key={n}>
                  {i.field}: {i.value || '(blank)'} · {i.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Imported from tracker row {data.tracker_row ?? '?'}{rfp.import_reviewed ? ' · reviewed' : ''}.</p>
      </CardContent>
    </Card>
  )
}
