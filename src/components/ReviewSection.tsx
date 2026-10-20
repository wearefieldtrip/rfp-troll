import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ReviewReport } from '@/components/ReviewReport'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { invokeFunction } from '@/lib/functions'
import { rfpReviewsQuery } from '@/lib/queries'
import type { ReviewResult } from '@/lib/review-result'

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

const startReview = (rfpId: string) => invokeFunction('review-rfp', { rfp_id: rfpId })

export function ReviewSection({ rfpId, hasDocuments }: { rfpId: string; hasDocuments: boolean }) {
  const queryClient = useQueryClient()
  const reviews = useQuery(rfpReviewsQuery(rfpId))
  const start = useMutation({
    mutationFn: () => startReview(rfpId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['rfps', rfpId, 'reviews'] }),
  })

  const latest = reviews.data?.[0]
  const running = latest?.status === 'running'
  const author = latest?.profiles?.full_name ?? latest?.profiles?.email

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fit review</CardTitle>
        <CardAction>
          <Button size="sm" disabled={!hasDocuments || running || start.isPending} onClick={() => start.mutate()}>
            {running || start.isPending ? 'Reviewing…' : latest ? 'Run again' : 'Run fit review'}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {start.error && <p className="text-sm text-destructive">{start.error.message}</p>}
        {!hasDocuments && <p className="text-sm text-muted-foreground">Add the RFP document to run a review.</p>}

        {reviews.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : !latest ? (
          hasDocuments && (
            <p className="text-sm text-muted-foreground">
              Claude reads the RFP against your current rubric and reports a score for each dimension. You make the call.
            </p>
          )
        ) : running ? (
          <p className="text-sm text-muted-foreground">Reading the RFP against the rubric. This usually takes a minute or two.</p>
        ) : latest.status === 'failed' ? (
          <p className="text-sm text-destructive">{latest.error ?? 'The review failed.'}</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Rubric version {latest.rubrics?.version} · {formatDateTime(latest.created_at)}
              {author && ` · run by ${author}`}
            </p>
            <ReviewReport result={latest.result as unknown as ReviewResult} totalScore={latest.total_score ?? 0} />
          </>
        )}
      </CardContent>
    </Card>
  )
}
