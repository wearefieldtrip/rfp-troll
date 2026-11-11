import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  countAiTagging,
  previewProposalLinks,
  previewTrackerImport,
  runAiTagging,
  runProposalLinks,
  runTrackerImport,
  type ImportPreview,
  type ImportResult,
  type LinkReport,
  type TagCount,
  type TagRun,
} from '@/lib/functions'
import { ACTION_LABELS, describeActions, describeAdded, describeLinks, describeOutcomes, OUTCOME_LABELS, parseRowNumber, STAGE_LABELS } from '@/lib/import-view'
import { LINK_STATUS_LABELS } from '@/lib/proposal-link'

export default function ImportsPage() {
  const queryClient = useQueryClient()
  // Start small: a few rows first, then the rest.
  const [from, setFrom] = useState('2')
  const [to, setTo] = useState('4')
  const [confirming, setConfirming] = useState(false)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [links, setLinks] = useState<LinkReport | null>(null)
  const [tagCount, setTagCount] = useState<TagCount | null>(null)
  const [tagging, setTagging] = useState(false)
  const [tagRun, setTagRun] = useState<TagRun | null>(null)

  const fromRow = parseRowNumber(from)
  const toRow = parseRowNumber(to)
  const rangeOk = fromRow !== 'invalid' && toRow !== 'invalid' && (fromRow === undefined || toRow === undefined || fromRow <= toRow)
  const range = { from: fromRow === 'invalid' ? undefined : fromRow, to: toRow === 'invalid' ? undefined : toRow }

  const changeRange = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    set(e.target.value)
    // The preview belongs to the rows it was made for.
    setPreview(null)
    setResult(null)
    setLinks(null)
    setTagRun(null)
  }

  const runPreview = useMutation({
    mutationFn: () => previewTrackerImport(range),
    onSuccess: (data) => {
      setPreview(data)
      setResult(null)
    },
  })

  const runImport = useMutation({
    mutationFn: () => runTrackerImport(range),
    onSuccess: async (data) => {
      setResult(data)
      setPreview(null)
      setConfirming(false)
      await queryClient.invalidateQueries({ queryKey: ['rfps'] })
      await queryClient.invalidateQueries({ queryKey: ['tags'] })
    },
  })

  const checkLinks = useMutation({
    mutationFn: () => previewProposalLinks(range),
    onSuccess: setLinks,
  })
  const saveLinks = useMutation({
    mutationFn: () => runProposalLinks(range),
    onSuccess: async (data) => {
      setLinks(data)
      await queryClient.invalidateQueries({ queryKey: ['rfps'] })
    },
  })

  const countTags = useMutation({
    mutationFn: () => countAiTagging(range),
    onSuccess: (data) => {
      setTagCount(data)
      setTagging(true)
    },
  })
  const runTags = useMutation({
    mutationFn: () => runAiTagging(range),
    onSuccess: async (data) => {
      setTagRun(data)
      setTagging(false)
      await queryClient.invalidateQueries({ queryKey: ['rfps'] })
      await queryClient.invalidateQueries({ queryKey: ['tags'] })
    },
  })

  const busy = runPreview.isPending || runImport.isPending || checkLinks.isPending || saveLinks.isPending || countTags.isPending || runTags.isPending
  const toDo = preview ? preview.summary.rows - (preview.summary.actions.skip_reviewed ?? 0) : 0

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Imports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Past RFPs from the tracker become closed RFPs, with their outcome and tags. No AI is used here. It is safe to run again: it updates rows nobody has
          reviewed and never makes a second copy.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>RFP tracker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="from-row">From row</Label>
              <Input id="from-row" inputMode="numeric" value={from} onChange={changeRange(setFrom)} className="w-24" disabled={busy} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to-row">To row</Label>
              <Input id="to-row" inputMode="numeric" value={to} onChange={changeRange(setTo)} className="w-24" disabled={busy} />
            </div>
            <Button variant="outline" disabled={!rangeOk || busy} onClick={() => runPreview.mutate()}>
              {runPreview.isPending ? 'Reading the tracker…' : 'Preview'}
            </Button>
            <Button disabled={!rangeOk || busy || !preview || toDo === 0} onClick={() => setConfirming(true)}>
              Import
            </Button>
          </div>
          <p className="text-muted-foreground">
            Rows are the sheet's own numbers; row 1 is the header. Leave both blank for every row. Preview first: it shows what would happen and writes nothing.
          </p>
          {!rangeOk && <p className="text-destructive">Use whole row numbers from 2 up, with From not after To.</p>}
          {runPreview.error && <p className="text-destructive">{runPreview.error.message}</p>}
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              <span className="font-medium">{preview.summary.rows} rows</span> · {describeActions(preview.summary.actions)}
              {describeOutcomes(preview.summary.outcomes) && <span className="text-muted-foreground"> · {describeOutcomes(preview.summary.outcomes)}</span>}
            </p>
            {preview.summary.unmapped.length > 0 && (
              <div className="space-y-1">
                <p className="font-medium">
                  {preview.summary.rowsWithIssues} {preview.summary.rowsWithIssues === 1 ? 'row has' : 'rows have'} values that need review
                </p>
                <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                  {preview.summary.unmapped.map((u) => (
                    <li key={u.what}>
                      {u.what} <span className="text-foreground/60">({u.rows})</span>
                    </li>
                  ))}
                </ul>
                <p className="text-muted-foreground">They import anyway, without that tag, and wait on the Review imports list.</p>
              </div>
            )}
            <ul className="divide-y rounded-md border">
              {preview.rows.map((r) => (
                <li key={r.row} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2">
                  <span className="w-8 text-muted-foreground">{r.row}</span>
                  <span className="min-w-0 flex-1 font-medium break-words">{r.client}</span>
                  <span className="text-muted-foreground">
                    {r.year ?? '—'} · {OUTCOME_LABELS[r.outcome] ?? r.outcome}
                    {r.stage && ` · ${STAGE_LABELS[r.stage] ?? r.stage}`}
                  </span>
                  <span className="w-44 text-right text-xs text-muted-foreground">
                    {ACTION_LABELS[r.action]}
                    {r.issues.length > 0 && ` · ${r.issues.length} to review`}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Imported</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              {result.created} created · {result.updated} updated · {result.skipped} left alone
              {result.failed.length > 0 && ` · ${result.failed.length} failed`}
            </p>
            {result.failed.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-5 text-destructive">
                {result.failed.map((f) => (
                  <li key={f.row}>
                    Row {f.row}: {f.error}
                  </li>
                ))}
              </ul>
            )}
            {result.missingTagValues.length > 0 && (
              <p className="text-muted-foreground">Not in the Library lists, so not tagged: {result.missingTagValues.join('; ')}.</p>
            )}
            <p>
              <Link to="/?view=all" className="underline underline-offset-4">
                See them in the RFP list
              </Link>
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Proposal links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Each imported RFP's tracker row links to its proposal Doc. This checks that the Doc can be opened and finds its PDF export beside it. It uses the
            rows above, and only RFPs already imported. A link you set by hand is never replaced.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" disabled={!rangeOk || busy} onClick={() => checkLinks.mutate()}>
              {checkLinks.isPending ? 'Checking…' : 'Check links'}
            </Button>
            <Button disabled={!rangeOk || busy || !links || links.written !== undefined || links.summary.rows === 0} onClick={() => saveLinks.mutate()}>
              {saveLinks.isPending ? 'Saving…' : 'Save links'}
            </Button>
          </div>
          {(checkLinks.error || saveLinks.error) && <p className="text-destructive">{(checkLinks.error ?? saveLinks.error)?.message}</p>}
          {links && (
            <div className="space-y-3">
              <p>
                <span className="font-medium">{links.summary.rows} RFPs</span> · {describeLinks(links.summary)}
                {links.written !== undefined && <span className="font-medium"> · saved {links.written}</span>}
              </p>
              {links.failed && links.failed.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-5 text-destructive">
                  {links.failed.map((f) => (
                    <li key={f.row}>
                      Row {f.row}: {f.error}
                    </li>
                  ))}
                </ul>
              )}
              {links.summary.no_access > 0 && (
                <p className="text-muted-foreground">
                  "Can't open it" means the service account can't see that Doc. Share it with the service account as Viewer, or move it into the shared drive, then check again.
                </p>
              )}
              <ul className="divide-y rounded-md border">
                {links.rows.map((r) => (
                  <li key={r.row} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2">
                    <span className="w-8 text-muted-foreground">{r.row}</span>
                    <span className="min-w-0 flex-1 font-medium break-words">{r.client}</span>
                    <span className={r.status === 'linked' ? 'text-muted-foreground' : 'text-destructive'}>
                      {LINK_STATUS_LABELS[r.status]}
                      {r.status === 'linked' && (r.hasPdf ? ' · PDF found' : ' · no PDF')}
                      {r.byHand && ' · set by hand'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI tagging</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Reads each imported RFP's proposal Doc and adds the requirements it asked of bidders, plus a sector where the tracker has none. A topic it thinks is missing
            is only suggested for the Library. Everything it adds is unconfirmed until someone reviews it, and it never changes a tag from the tracker or one you set. It uses
            the rows above and a stronger AI model, a few Docs at a time.
          </p>
          <Button disabled={!rangeOk || busy} onClick={() => countTags.mutate()}>
            {countTags.isPending ? 'Counting…' : 'Tag with AI'}
          </Button>
          {(countTags.error || (!tagging && runTags.error)) && <p className="text-destructive">{(countTags.error ?? runTags.error)?.message}</p>}
          {tagRun && (
            <div className="space-y-3">
              <p>
                <span className="font-medium">{tagRun.tagged} tagged</span>
                {tagRun.failed > 0 && <span className="text-destructive"> · {tagRun.failed} failed</span>}
                {tagRun.remaining > 0 ? ` · ${tagRun.remaining} still to do: run it again to continue` : ' · nothing left to tag in these rows'}
              </p>
              <ul className="divide-y rounded-md border">
                {tagRun.results.map((r) => (
                  <li key={r.row} className="space-y-0.5 px-3 py-2">
                    <p className="flex flex-wrap items-baseline gap-x-3">
                      <span className="w-8 text-muted-foreground">{r.row}</span>
                      <span className="min-w-0 flex-1 font-medium break-words">{r.client}</span>
                      {r.status === 'failed' && <span className="text-destructive">Failed</span>}
                    </p>
                    {r.status === 'tagged' && <p className="pl-11 text-muted-foreground">{describeAdded(r.added) || 'Nothing new to add.'}</p>}
                    {r.suggested && r.suggested.length > 0 && <p className="pl-11 text-muted-foreground">Suggested for the Library: {r.suggested.join('; ')}</p>}
                    {r.error && <p className="pl-11 text-destructive">{r.error}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={tagging} onOpenChange={(open) => !runTags.isPending && setTagging(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tag with AI?</DialogTitle>
            <DialogDescription>
              {tagCount && tagCount.eligible > 0
                ? `This reads ${Math.min(tagCount.eligible, tagCount.perRun)} proposal ${Math.min(tagCount.eligible, tagCount.perRun) === 1 ? 'Doc' : 'Docs'} now${tagCount.eligible > tagCount.perRun ? ` (${tagCount.eligible} are waiting; it does ${tagCount.perRun} at a time, so run it again for the rest)` : ''} and uses a small amount of AI credit.`
                : 'There is nothing to tag in these rows.'}
              {tagCount && (tagCount.alreadyTagged > 0 || tagCount.reviewed > 0 || tagCount.noDoc > 0) && (
                <>
                  {' '}
                  Skipped: {[tagCount.alreadyTagged ? `${tagCount.alreadyTagged} already tagged` : '', tagCount.reviewed ? `${tagCount.reviewed} reviewed` : '', tagCount.noDoc ? `${tagCount.noDoc} with no proposal linked` : ''].filter(Boolean).join(', ')}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {runTags.error && <p className="text-sm text-destructive">{runTags.error.message}</p>}
          <DialogFooter>
            <Button variant="outline" disabled={runTags.isPending} onClick={() => setTagging(false)}>
              Cancel
            </Button>
            <Button disabled={runTags.isPending || !tagCount || tagCount.eligible === 0} onClick={() => runTags.mutate()}>
              {runTags.isPending ? 'Reading the proposals…' : 'Tag with AI'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirming} onOpenChange={(open) => !runImport.isPending && setConfirming(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import {toDo} {toDo === 1 ? 'row' : 'rows'}?</DialogTitle>
            <DialogDescription>
              Each row becomes a closed RFP with its outcome and tags from the tracker. Nothing uses AI credit. Running it again updates these rows, never duplicates them.
            </DialogDescription>
          </DialogHeader>
          {runImport.error && <p className="text-sm text-destructive">{runImport.error.message}</p>}
          <DialogFooter>
            <Button variant="outline" disabled={runImport.isPending} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button disabled={runImport.isPending} onClick={() => runImport.mutate()}>
              {runImport.isPending ? 'Importing…' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
