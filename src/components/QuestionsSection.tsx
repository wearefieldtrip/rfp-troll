import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ExternalLinkIcon, LoaderCircleIcon } from 'lucide-react'
import { useState } from 'react'
import { MarkSentDialog } from '@/components/MarkSentDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { questionsDoc } from '@/lib/functions'
import { docContents, docUrl, fileUrl, formatDay } from '@/lib/questions-view'
import type { Database } from '@/lib/database.types'

type Rfp = Database['public']['Tables']['rfps']['Row']

function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
      {children}
      <ExternalLinkIcon className="size-3" aria-hidden />
    </a>
  )
}

/** Step 2. What it shows follows the status. */
export function QuestionsSection({ rfp }: { rfp: Rfp }) {
  const queryClient = useQueryClient()
  const [marking, setMarking] = useState(false)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['rfps', rfp.id] })

  const build = useMutation({ mutationFn: () => questionsDoc(rfp.id, 'build'), onSettled: refresh })
  const retrySuggestions = useMutation({ mutationFn: () => questionsDoc(rfp.id, 'suggest'), onSettled: refresh })

  if (rfp.status === 'questions_sent' || rfp.status === 'questions_answers_in') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Waiting for answers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            {rfp.questions_sent_count ?? 0} questions sent{rfp.questions_sent_on ? ` on ${formatDay(rfp.questions_sent_on)}` : ''}.
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
            {rfp.questions_sent_pdf_id && <ExternalLink href={fileUrl(rfp.questions_sent_pdf_id)}>Questions as sent (PDF)</ExternalLink>}
            {rfp.questions_doc_id && <ExternalLink href={docUrl(rfp.questions_doc_id)}>Questions doc</ExternalLink>}
          </p>
        </CardContent>
      </Card>
    )
  }

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
