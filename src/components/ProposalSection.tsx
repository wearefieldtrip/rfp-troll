import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ExternalLinkIcon, LoaderCircleIcon } from 'lucide-react'
import { useState } from 'react'
import { BaseProposalPicker } from '@/components/BaseProposalPicker'
import { chosenBaseId, useBaseCandidates } from '@/lib/base-candidates'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buildRequirements, proposalDoc } from '@/lib/functions'
import { dayCountLabel, daysUntilMoment } from '@/lib/key-dates'
import { momentFrom } from '@/lib/moment-columns'
import { baseLabel, draftSummaryLine, type DraftSummary } from '@/lib/proposal-view'
import { docUrl } from '@/lib/questions-view'
import { formatMoment } from '@/lib/rfp-dates'
import { cleanRequirements, requirementsSummary } from '@/lib/requirements'
import type { Database } from '@/lib/database.types'

type Rfp = Database['public']['Tables']['rfps']['Row']

/** Step 3. The proposal Doc is a copy of a past proposal; this shows what the build did and what the RFP asks for. */
export function ProposalSection({ rfp }: { rfp: Rfp }) {
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['rfps', rfp.id] })
  const [picked, setPicked] = useState<string | null>(rfp.proposal_base_rfp_id)
  const year = new Date(rfp.created_at).getFullYear()
  const candidates = useBaseCandidates(rfp.id, year)
  const baseId = chosenBaseId(candidates.ranked, picked)

  const readRequirements = useMutation({ mutationFn: () => buildRequirements(rfp.id), onSettled: refresh })
  const build = useMutation({
    mutationFn: async () => {
      if (!baseId) throw new Error('Choose a past proposal to start from.')
      // Read the requirements again first if they never finished; the doc waits for them.
      if (rfp.requirements_status !== 'ready' && rfp.requirements_status !== 'building') void buildRequirements(rfp.id).catch(() => undefined)
      await proposalDoc(rfp.id, baseId)
    },
    onSettled: refresh,
  })

  const draft = rfp.proposal_draft_status
  const summary = rfp.proposal_draft_summary as DraftSummary | null
  const requirements = rfp.requirements_status === 'ready' && rfp.requirements ? cleanRequirements(rfp.requirements) : null
  const due = momentFrom(rfp, 'proposal_due')
  const dueText = due ? `due ${formatMoment(due)} · ${dayCountLabel(daysUntilMoment(due))}` : null

  if (draft === 'building') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Creating the proposal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
            Reading what the RFP asks for, copying the past proposal and matching its sections. This takes a minute or two.
          </p>
          <Button size="sm" disabled>
            Open proposal
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (draft === 'ready' && rfp.proposal_draft_doc_id) {
    const line = draftSummaryLine(summary)
    return (
      <Card>
        <CardHeader>
          <p className="text-xs font-medium text-muted-foreground">3 · Proposal · Next step</p>
          <CardTitle>Write the proposal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            A first draft to take from here. It's {summary?.base.client ?? 'a past'} proposal's own words, matched to what the RFP asks for.
          </p>
          {requirements && (
            <p>
              {requirementsSummary(requirements)}
              {dueText && ` · ${dueText}`}
            </p>
          )}
          {summary?.base && (
            <p className="text-muted-foreground">
              Based on: {baseLabel(summary.base.client, rfp.title, summary.base.year, summary.base.outcome)}
            </p>
          )}
          {line && <p className="text-muted-foreground">{line}</p>}
          {summary && summary.moves.length > 0 && (
            <div className="rounded-lg bg-muted px-3 py-2">
              <p className="font-medium">Sections to move (Google Docs can't be reordered by the app)</p>
              <ul className="list-disc pl-5">
                {summary.moves.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" render={<a href={docUrl(rfp.proposal_draft_doc_id)} target="_blank" rel="noreferrer" />}>
              Open proposal
              <ExternalLinkIcon aria-hidden />
            </Button>
            <Button size="sm" variant="outline" disabled={build.isPending || !baseId} onClick={() => build.mutate()}>
              Build it again
            </Button>
          </div>
          {build.error && <p className="text-destructive">{build.error.message}</p>}
          {requirements && <RequirementsList rfp={rfp} />}
          {rfp.requirements_status === 'failed' && <RequirementsFailed rfp={rfp} onRetry={() => readRequirements.mutate()} pending={readRequirements.isPending} />}
        </CardContent>
      </Card>
    )
  }

  // No doc yet: it failed, never started (no past proposal at the time), or the base is still to be chosen.
  return (
    <Card>
      <CardHeader>
        <CardTitle>{draft === 'failed' ? "The proposal couldn't be created" : 'The proposal has not been created'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {draft === 'failed' && rfp.proposal_draft_error && <p className="text-destructive">{rfp.proposal_draft_error}</p>}
        <BaseProposalPicker rfpId={rfp.id} year={year} value={picked} onChange={setPicked} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={build.isPending || !baseId} onClick={() => build.mutate()}>
            {build.isPending ? 'Starting…' : draft === 'failed' ? 'Try again' : 'Create the proposal'}
          </Button>
        </div>
        {build.error && <p className="text-destructive">{build.error.message}</p>}
        {requirements && <RequirementsList rfp={rfp} />}
        {rfp.requirements_status === 'failed' && <RequirementsFailed rfp={rfp} onRetry={() => readRequirements.mutate()} pending={readRequirements.isPending} />}
      </CardContent>
    </Card>
  )
}

function RequirementsFailed({ rfp, onRetry, pending }: { rfp: Rfp; onRetry: () => void; pending: boolean }) {
  return (
    <div className="space-y-2 rounded-lg bg-muted px-3 py-2">
      <p>The requirements couldn't be read{rfp.requirements_error ? `: ${rfp.requirements_error}` : '.'}</p>
      <Button size="sm" variant="outline" disabled={pending} onClick={onRetry}>
        {pending ? 'Starting…' : 'Read the requirements again'}
      </Button>
    </div>
  )
}

/** What the RFP asks for, as a folded list. Step 4 checks the proposal against this. */
function RequirementsList({ rfp }: { rfp: Rfp }) {
  const req = cleanRequirements(rfp.requirements)
  return (
    <details className="rounded-lg border px-3 py-2">
      <summary className="cursor-pointer font-medium">Requirements ({req.sections.length} section{req.sections.length === 1 ? '' : 's'})</summary>
      <div className="mt-3 space-y-4">
        {req.sections.length === 0 ? (
          <p className="text-muted-foreground">The RFP doesn't set a structure for the response.</p>
        ) : (
          <ol className="space-y-3">
            {req.sections.map((s) => (
              <li key={s.title}>
                <p className="font-medium">
                  {s.order}. {s.title}
                  <span className="font-normal text-muted-foreground">
                    {[s.pageLimit, s.points, s.source].filter(Boolean).map((t) => ` · ${t}`).join('')}
                  </span>
                </p>
                {s.mustAddress.length > 0 && (
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {s.mustAddress.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
        {req.attachments.length > 0 && (
          <div>
            <p className="font-medium">Attachments</p>
            <ul className="list-disc pl-5 text-muted-foreground">
              {req.attachments.map((a) => (
                <li key={a.name}>
                  {a.name}
                  {a.source && ` (${a.source})`}
                </li>
              ))}
            </ul>
          </div>
        )}
        {(req.submission.method || req.submission.formatRules.length > 0) && (
          <div>
            <p className="font-medium">Submission</p>
            <ul className="list-disc pl-5 text-muted-foreground">
              {req.submission.method && <li>{req.submission.method}</li>}
              {req.submission.formatRules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  )
}
