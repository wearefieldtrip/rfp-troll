import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLinkIcon, LoaderCircleIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AddAnswersDialog } from '@/components/AddAnswersDialog'
import { AnswersInCard, FailedReadingCard, NoAnswersCard, ReadingCard, WaitingCard } from '@/components/AnswersCards'
import { MarkSentDialog } from '@/components/MarkSentDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { answersState, stillUnanswered, toAnswersResult } from '@/lib/answers-view'
import { questionsDoc, readAnswers } from '@/lib/functions'
import { rfpAnswersQuery, rfpReviewsQuery } from '@/lib/queries'
import { docContents, docUrl } from '@/lib/questions-view'
import type { Database } from '@/lib/database.types'

type Rfp = Database['public']['Tables']['rfps']['Row']

/** Step 2. What it shows follows the status. */
export function QuestionsSection({ rfp, scoreText }: { rfp: Rfp; scoreText: string | null }) {
  const queryClient = useQueryClient()
  const [marking, setMarking] = useState(false)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['rfps', rfp.id] })

  const build = useMutation({ mutationFn: () => questionsDoc(rfp.id, 'build'), onSettled: refresh })
  const retrySuggestions = useMutation({ mutationFn: () => questionsDoc(rfp.id, 'suggest'), onSettled: refresh })

  if (rfp.status === 'questions_sent' || rfp.status === 'questions_answers_in') return <AnswersStep rfp={rfp} scoreText={scoreText} />

  const status = rfp.questions_doc_status

  if (status === 'building') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Creating the questions doc</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
            Choosing the template questions that fit and adding the fit review's questions. This takes under a minute.
          </p>
          <div className="flex gap-2">
            <Button size="sm" disabled>
              Open questions doc
            </Button>
            <Button size="sm" variant="outline" disabled>
              Mark as sent
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (status !== 'ready' || !rfp.questions_doc_id) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{status === 'failed' ? "The questions doc couldn't be created" : 'The questions doc has not been created'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {rfp.questions_doc_error && <p className="text-destructive">{rfp.questions_doc_error}</p>}
          {build.error && <p className="text-destructive">{build.error.message}</p>}
          <p className="text-muted-foreground">Creating it uses a small amount of AI credit to choose which template questions fit this RFP.</p>
          <Button size="sm" disabled={build.isPending} onClick={() => build.mutate()}>
            {build.isPending ? 'Starting…' : status === 'failed' ? 'Retry' : 'Create the questions doc'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Review the questions doc and send it</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            The doc has {docContents(rfp.questions_bank_count, rfp.questions_suggestions_status === 'added' ? rfp.questions_suggested_count : null)}.
            {rfp.questions_suggested_count ? ' The AI suggested ones are Google Docs suggestions: accept or reject each one.' : ''}
          </p>
          {rfp.questions_suggestions_status === 'failed' && (
            <p className="flex flex-wrap items-center gap-2 text-destructive">
              Suggestions not added.
              <Button size="sm" variant="outline" disabled={retrySuggestions.isPending} onClick={() => retrySuggestions.mutate()}>
                {retrySuggestions.isPending ? 'Retrying…' : 'Retry'}
              </Button>
            </p>
          )}
          {retrySuggestions.error && <p className="text-destructive">{retrySuggestions.error.message}</p>}
          <p className="text-muted-foreground">The CONTACT line is left for you to fill in. Send it to the client yourself, then click Mark as sent so we can track the reply.</p>
          <div className="flex gap-2">
            <Button size="sm" render={<a href={docUrl(rfp.questions_doc_id)} target="_blank" rel="noreferrer" />}>
              Open questions doc
              <ExternalLinkIcon aria-hidden />
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMarking(true)}>
              Mark as sent
            </Button>
          </div>
        </CardContent>
      </Card>
      <MarkSentDialog rfpId={rfp.id} open={marking} onOpenChange={setMarking} />
    </>
  )
}

/** After the questions are sent: waiting, reading the answers, and the decision. */
function AnswersStep({ rfp, scoreText }: { rfp: Rfp; scoreText: string | null }) {
  const queryClient = useQueryClient()
  const answers = useQuery(rfpAnswersQuery(rfp.id))
  const reviews = useQuery(rfpReviewsQuery(rfp.id))
  const [adding, setAdding] = useState(false)
  const [withoutAnswers, setWithoutAnswers] = useState(false)

  const rows = answers.data ?? []
  const latest = rows[0]
  const latestState = latest ? answersState(latest) : null
  const latestDone = rows.find((r) => answersState(r) === 'done')

  // When a batch finishes, the RFP's status, dates and score have changed too.
  useEffect(() => {
    if (latestState === 'done') void queryClient.invalidateQueries({ queryKey: ['rfps', rfp.id] })
  }, [latestState, latest?.id, queryClient, rfp.id])

  const retry = useMutation({
    mutationFn: (id: string) => readAnswers(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['rfps', rfp.id] }),
  })

  if (answers.isPending) return <Skeleton className="h-32 w-full" />

  const addDialog = <AddAnswersDialog rfpId={rfp.id} more={rows.length > 0} open={adding} onOpenChange={setAdding} />

  if (latest && latestState === 'reading') return <ReadingCard />

  const failedCard =
    latest && latestState === 'failed' ? (
      <FailedReadingCard error={latest.error} retrying={retry.isPending} onRetry={() => retry.mutate(latest.id)} />
    ) : null

  if (rfp.status === 'questions_answers_in' && latestDone) {
    return (
      <>
        {failedCard}
        <AnswersInCard rfp={rfp} answers={rows} result={toAnswersResult(latestDone.result)} scoreText={scoreText} onAddMore={() => setAdding(true)} />
        {addDialog}
      </>
    )
  }

  if (withoutAnswers) {
    // No answers have been read yet, so the latest review is still the one from the RFP alone.
    const review = reviews.data?.find((r) => r.status === 'complete')
    return (
      <>
        {failedCard}
        <NoAnswersCard rfp={rfp} scoreText={scoreText} open={stillUnanswered(review?.result)} onBack={() => setWithoutAnswers(false)} />
      </>
    )
  }

  return (
    <>
      {failedCard}
      <WaitingCard rfp={rfp} answers={rows} onAdd={() => setAdding(true)} onDecideWithout={() => setWithoutAnswers(true)} />
      {addDialog}
    </>
  )
}
