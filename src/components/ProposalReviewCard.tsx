import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ExternalLinkIcon, LoaderCircleIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { proposalReview } from '@/lib/functions'
import { reviewProblems, reviewSummary, type ProposalReview } from '@/lib/proposal-review'
import { docUrl } from '@/lib/questions-view'
import type { Database } from '@/lib/database.types'

type Rfp = Database['public']['Tables']['rfps']['Row']

/** Step 4: the AI check of the proposal against the requirements. A draft checklist; it never edits the Doc. */
export function ProposalReviewCard({ rfp }: { rfp: Rfp }) {
  const queryClient = useQueryClient()
  const run = useMutation({
    mutationFn: () => proposalReview(rfp.id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['rfps', rfp.id] }),
  })
  const status = rfp.proposal_review_status
  const review = rfp.proposal_review as ProposalReview | null
  const docLink = rfp.proposal_draft_doc_id ? docUrl(rfp.proposal_draft_doc_id) : null
  const noRequirements = rfp.requirements_status !== 'ready'

  if (status === 'building') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Checking the proposal</CardTitle>
        </CardHeader>
        <CardContent>
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
            Reading the proposal against what the RFP asks for. This takes a minute or two.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (status === 'ready' && review) {
    const problems = reviewProblems(review)
    const when = new Date(review.checkedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    return (
      <Card>
        <CardHeader>
          <CardTitle>Review</CardTitle>
          <p className="text-xs text-muted-foreground">AI check · {when} · a draft checklist, it can miss things</p>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="font-medium">{reviewSummary(review)}</p>
          {review.pageCount && <p className="text-muted-foreground">The Doc runs {review.pageCount} page{review.pageCount === 1 ? '' : 's'}.</p>}
          {!review.pagesChecked && <p className="text-muted-foreground">The Doc is too large for Google to export as a PDF, so page counts and page limits weren't checked.</p>}
          {problems.length === 0 ? (
            <p className="text-muted-foreground">Nothing was flagged against the requirements.</p>
          ) : (
            <ul className="list-disc space-y-1.5 pl-5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          <p className="text-muted-foreground">The details are comments in the proposal Doc, starting "▸ Review". The check never edits it.</p>
          <div className="flex flex-wrap gap-2">
            {docLink && (
              <Button size="sm" render={<a href={docLink} target="_blank" rel="noreferrer" />}>
                Open proposal
                <ExternalLinkIcon aria-hidden />
              </Button>
            )}
            <Button size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate()}>
              {run.isPending ? 'Starting…' : 'Check again'}
            </Button>
          </div>
          {run.error && <p className="text-destructive">{run.error.message}</p>}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{status === 'failed' ? "The check couldn't run" : 'Check the proposal'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {status === 'failed' && rfp.proposal_review_error && <p className="text-destructive">{rfp.proposal_review_error}</p>}
        <p className="text-muted-foreground">
          {noRequirements
            ? "The requirements list isn't ready, so there is nothing to check the proposal against."
            : "Checks the proposal against the RFP's requirements: sections, page limits, attachments and submission rules. It adds comments to the Doc and never edits it."}
        </p>
        <Button size="sm" disabled={run.isPending || noRequirements || !rfp.proposal_draft_doc_id} onClick={() => run.mutate()}>
          {run.isPending ? 'Starting…' : status === 'failed' ? 'Try again' : 'Check the proposal'}
        </Button>
        {run.error && <p className="text-destructive">{run.error.message}</p>}
      </CardContent>
    </Card>
  )
}
