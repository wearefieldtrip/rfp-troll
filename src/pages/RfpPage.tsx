import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LoaderCircleIcon, MoreHorizontalIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChangeOwnerDialog } from '@/components/ChangeOwnerDialog'
import { DecisionButtons } from '@/components/DecisionCard'
import { DecisionRecord } from '@/components/DecisionRecord'
import { DeleteRfpDialog } from '@/components/DeleteRfpDialog'
import { EditRfpDialog } from '@/components/EditRfpDialog'
import { KeyFacts } from '@/components/KeyFacts'
import { ProgressStrip } from '@/components/ProgressStrip'
import { ReopenDialog } from '@/components/ReopenDialog'
import { ReplaceFileDialog } from '@/components/ReplaceFileDialog'
import { ReviewSection } from '@/components/ReviewSection'
import { StepSection } from '@/components/StepSection'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { decisionWhat, decisionWhen, decisionWho } from '@/lib/decision-text'
import { syncRfpFolder } from '@/lib/functions'
import { momentFrom } from '@/lib/moment-columns'
import { jobStates, type ReviewState } from '@/lib/progress'
import { rfpDecisionsQuery, rfpDocumentsQuery, rfpQuery, rfpReviewsQuery, teamQuery } from '@/lib/queries'
import { isClosed, statusLabel, statusVariant, stepOf } from '@/lib/rfp-status'
import { cleanBandLabel, MAX_TOTAL } from '@/lib/rubric-structure'
import { supabase } from '@/lib/supabase'

type Dialog = 'owner' | 'replace' | 'reopen' | 'delete' | null

const STEP_TITLES = { questions: 'Questions', proposal: 'Proposal', submitted: 'Submitted' } as const
const STEP_NUMBERS = { questions: 2, proposal: 3, submitted: 4 } as const

export default function RfpPage() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [rerunning, setRerunning] = useState(false)
  // Whether the Evaluate step is folded. Unset means "follow the status": open until the RFP moves on.
  const [evaluateOpen, setEvaluateOpen] = useState<boolean | null>(null)

  const rfp = useQuery(rfpQuery(id))
  const syncing = rfp.data?.drive_status === 'syncing'
  const documents = useQuery({ ...rfpDocumentsQuery(id), refetchInterval: syncing ? 2500 : false })
  const reviews = useQuery(rfpReviewsQuery(id))
  const decisions = useQuery(rfpDecisionsQuery(id))
  const team = useQuery(teamQuery)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['rfps', id] })

  const retrySync = useMutation({ mutationFn: () => syncRfpFolder(id), onSettled: refresh })
  // Reading the names again is a sync with the extraction step switched back on.
  const retryNames = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('rfps').update({ extract_status: 'pending', extract_error: null }).eq('id', id)
      if (error) throw error
      await syncRfpFolder(id)
    },
    onSettled: refresh,
  })

  if (rfp.isPending) return <Skeleton className="h-48 w-full max-w-3xl" />
  if (rfp.error) return <p className="text-destructive">Could not load this RFP.</p>

  const data = rfp.data
  const status = data.status
  const step = stepOf(status)
  const closed = isClosed(status)
  const reading = data.extract_status === 'pending' && data.drive_status === 'syncing'
  const completedReview = reviews.data?.find((r) => r.status === 'complete')
  const scoreText = completedReview?.total_score != null ? `${completedReview.total_score} / ${MAX_TOTAL} · ${cleanBandLabel(completedReview.decision_band)}` : null

  const latestReview = reviews.data?.[0]
  const reviewState: ReviewState = completedReview ? 'complete' : latestReview?.status === 'running' ? 'running' : latestReview?.status === 'failed' ? 'failed' : 'none'
  const jobs = jobStates(data, reviewState)
  const retryingJob = retrySync.isPending || retryNames.isPending

  const owner = team.data?.find((p) => p.id === data.owner_id)
  const latestDecision = decisions.data?.[0]
  const evaluateIsCurrent = step === 'evaluate'
  const evaluateExpanded = evaluateOpen ?? evaluateIsCurrent
  const currentLater = step === 'questions' || step === 'proposal' || step === 'submitted' ? step : null
  // A file that is still being swapped in, or a folder still being set up, shouldn't be reviewed in the meantime.
  const canReview = (documents.data?.length ?? 0) > 0 && !syncing

  const decisionControls = (enabled: boolean) =>
    status === 'evaluate_ready' ? <DecisionButtons rfp={data} scoreText={scoreText} enabled={enabled} /> : null

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:underline">
          ← All RFPs
        </Link>
        {data.client_name && <p className="mt-2 text-sm text-muted-foreground">{data.client_name}</p>}
        <div className={`${data.client_name ? '' : 'mt-2 '}flex items-center gap-3`}>
          <h1 className="text-2xl font-semibold">{data.title}</h1>
          <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="More actions" className="ml-auto" />}>
              <MoreHorizontalIcon aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {closed ? (
                <DropdownMenuItem onClick={() => setDialog('reopen')}>Reopen</DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem disabled={!canReview || !completedReview || latestReview?.status === 'running'} onClick={() => setRerunning(true)}>
                    Run review again
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={syncing} onClick={() => setDialog('replace')}>
                    Replace RFP file
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem onClick={() => setDialog('owner')}>Change owner</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDialog('delete')}>
                Delete RFP
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Owner: {owner ? (owner.full_name ?? owner.email) : 'No one yet'}</p>
      </div>

      {status === 'evaluate_reading' && (
        <ProgressStrip jobs={jobs} retrying={retryingJob} onRetry={(key) => (key === 'names' ? retryNames.mutate() : retrySync.mutate())} />
      )}

      <KeyFacts rfp={data} reading={reading} onRetryDrive={() => retrySync.mutate()} retryingDrive={retrySync.isPending} />
      {(retrySync.error || retryNames.error) && <p className="text-sm text-destructive">{(retrySync.error ?? retryNames.error)?.message}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardAction>
            <EditRfpDialog
              rfp={{
                id,
                title: data.title,
                client_name: data.client_name,
                proposal: momentFrom(data, 'proposal_due'),
                budget_min_usd: data.budget_min_usd,
                budget_max_usd: data.budget_max_usd,
                budget_qualifier: data.budget_qualifier,
              }}
            />
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          {reading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
              Reading the RFP for its title, client and dates…
            </p>
          )}
          {data.extract_status === 'failed' && (
            <p className="text-sm text-muted-foreground">
              Couldn't read the details from the RFP{data.extract_error ? ` (${data.extract_error})` : ''}. Use Edit to add them.
            </p>
          )}
          {data.upload_note && <p className="text-sm text-amber-700 dark:text-amber-400">{data.upload_note}</p>}
          <dl className="grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">Client</dt>
            <dd>{data.client_name ?? '—'}</dd>
          </dl>
        </CardContent>
      </Card>

      <StepSection
        number={1}
        title="Evaluate"
        open={evaluateExpanded}
        onToggle={() => setEvaluateOpen(!evaluateExpanded)}
        summary={
          <>
            {scoreText ? `Fit review · ${scoreText}` : 'Fit review'}
            {latestDecision && ` · ${decisionWhat(latestDecision)} by ${decisionWho(latestDecision)} on ${decisionWhen(latestDecision.decided_at)}`}
          </>
        }
      >
        {reading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <ReviewSection rfpId={id} hasDocuments={canReview} confirming={rerunning} onConfirmingChange={setRerunning} renderDecision={decisionControls} />
        )}
        <DecisionRecord rfpId={id} />
      </StepSection>

      {currentLater && (
        <StepSection number={STEP_NUMBERS[currentLater]} title={STEP_TITLES[currentLater]} open onToggle={() => undefined}>
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                This step isn't built yet. The RFP's status moves with your decision, and its Drive folder is ready to work in.
              </p>
            </CardContent>
          </Card>
        </StepSection>
      )}

      <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40">
        <CardHeader>
          <CardTitle className="text-red-900 dark:text-red-200">Delete RFP</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm text-red-900/80 dark:text-red-200/80">Permanently remove this RFP from RFP Troll.</p>
          <Button variant="destructive" size="sm" onClick={() => setDialog('delete')}>
            Delete RFP
          </Button>
        </CardContent>
      </Card>

      <ChangeOwnerDialog rfpId={id} ownerId={data.owner_id} open={dialog === 'owner'} onOpenChange={(open) => setDialog(open ? 'owner' : null)} />
      <ReplaceFileDialog rfpId={id} open={dialog === 'replace'} onOpenChange={(open) => setDialog(open ? 'replace' : null)} />
      <ReopenDialog rfpId={id} passed={status === 'closed_passed'} open={dialog === 'reopen'} onOpenChange={(open) => setDialog(open ? 'reopen' : null)} />
      <DeleteRfpDialog
        rfp={{ id, title: data.title, drive_folder_id: data.drive_folder_id }}
        documentCount={documents.data?.length ?? 0}
        reviewCount={reviews.data?.length ?? 0}
        open={dialog === 'delete'}
        onOpenChange={(open) => setDialog(open ? 'delete' : null)}
      />
    </div>
  )
}
