import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LoaderCircleIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { CheckThis, FitCard, QuestionsCard, RisksCard } from '@/components/FitReview'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { invokeFunction } from '@/lib/functions'
import { rfpReviewsQuery } from '@/lib/queries'
import { toReviewView } from '@/lib/review-result'

const formatShortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

const startReview = (rfpId: string) => invokeFunction('review-rfp', { rfp_id: rfpId })

type Props = {
  rfpId: string
  hasDocuments: boolean
  /** Asking to run the review again is lifted so the page's menu can open the same confirmation. */
  confirming: boolean
  onConfirmingChange: (open: boolean) => void
  /** The decision buttons, told whether a finished review exists yet. */
  renderDecision?: (enabled: boolean) => ReactNode
}

export function ReviewSection({ rfpId, hasDocuments, confirming, onConfirmingChange: setConfirming, renderDecision }: Props) {
  const queryClient = useQueryClient()
  const reviews = useQuery(rfpReviewsQuery(rfpId))
  const start = useMutation({
    mutationFn: () => startReview(rfpId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['rfps', rfpId, 'reviews'] }),
  })

  const latest = reviews.data?.[0]
  const completed = reviews.data?.find((r) => r.status === 'complete')
  const running = latest?.status === 'running'
  const busy = running || start.isPending
  const canRun = hasDocuments && !busy

  const confirmRun = () => {
    setConfirming(false)
    start.mutate()
  }

  const confirmDialog = (
    <Dialog open={confirming} onOpenChange={setConfirming}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run the fit review again?</DialogTitle>
          <DialogDescription>
            This RFP already has a fit review. Running it again reads the RFP against your current rubric and uses more paid AI
            credits, so it's best to do it only if something has changed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button onClick={confirmRun}>Run again</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  // A finished review: the design's fit card, risks and questions. A newer run in progress or failed shows as a note above it.
  if (completed) {
    const view = toReviewView(completed.result, completed.total_score, completed.decision_band)
    return (
      <>
        {confirmDialog}
        {running && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
            Running a new review. This usually takes a minute or two.
          </p>
        )}
        {latest?.status === 'failed' && <p className="text-sm text-destructive">The latest review failed: {latest.error ?? 'please try again.'}</p>}
        {start.error && <p className="text-sm text-destructive">{start.error.message}</p>}
        <CheckThis flags={view.flags} />
        <FitCard
          view={view}
          actions={renderDecision?.(true)}
          footer={
            <>
              AI review · {formatShortDate(completed.created_at)}
              {completed.rubrics?.version != null && ` · rubric v${completed.rubrics.version}`} ·{' '}
              <button
                type="button"
                disabled={!canRun}
                onClick={() => setConfirming(true)}
                className="underline underline-offset-4 disabled:no-underline disabled:opacity-60"
              >
                Run again
              </button>
            </>
          }
        />
        <RisksCard risks={view.risks} notStated={view.notStated} />
        <QuestionsCard questions={view.questions} />
      </>
    )
  }

  // No finished review yet: running, failed, or not started.
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fit review</CardTitle>
        <CardAction>
          <Button size="sm" disabled={!canRun} onClick={() => start.mutate()}>
            {busy ? 'Reviewing…' : latest ? 'Run again' : 'Run fit review'}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {start.error && <p className="text-sm text-destructive">{start.error.message}</p>}
        {renderDecision?.(false)}
        {!hasDocuments && <p className="text-sm text-muted-foreground">Add the RFP document to run a review.</p>}
        {reviews.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : running ? (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
            Reading the RFP against the rubric. This usually takes a minute or two.
          </p>
        ) : latest?.status === 'failed' ? (
          <p className="text-sm text-destructive">{latest.error ?? 'The review failed.'}</p>
        ) : (
          hasDocuments && (
            <p className="text-sm text-muted-foreground">
              The RFP is read against your current rubric and scored on each dimension. You make the call.
            </p>
          )
        )}
      </CardContent>
    </Card>
  )
}
