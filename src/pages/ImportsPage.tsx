import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { previewTrackerImport, runTrackerImport, type ImportPreview, type ImportResult } from '@/lib/functions'
import { ACTION_LABELS, describeActions, describeOutcomes, OUTCOME_LABELS, parseRowNumber, STAGE_LABELS } from '@/lib/import-view'

export default function ImportsPage() {
  const queryClient = useQueryClient()
  // Start small: a few rows first, then the rest.
  const [from, setFrom] = useState('2')
  const [to, setTo] = useState('4')
  const [confirming, setConfirming] = useState(false)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const fromRow = parseRowNumber(from)
  const toRow = parseRowNumber(to)
  const rangeOk = fromRow !== 'invalid' && toRow !== 'invalid' && (fromRow === undefined || toRow === undefined || fromRow <= toRow)
  const range = { from: fromRow === 'invalid' ? undefined : fromRow, to: toRow === 'invalid' ? undefined : toRow }

  const changeRange = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    set(e.target.value)
    // The preview belongs to the rows it was made for.
    setPreview(null)
    setResult(null)
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

  const busy = runPreview.isPending || runImport.isPending
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
