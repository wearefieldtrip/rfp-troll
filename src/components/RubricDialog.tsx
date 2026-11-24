import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLinkIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { rubricDoc } from '@/lib/functions'
import { activeRubricQuery } from '@/lib/queries'
import { changesOnly, diffLines, RUBRIC_DOC_URL } from '@/lib/rubric-doc'
import { cn } from '@/lib/utils'

/** The rubric lives in a Google Doc the team edits. Here a person checks it, sees what changed, and publishes it as the next version. */
export function RubricDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const active = useQuery(activeRubricQuery)

  const check = useMutation({ mutationFn: () => rubricDoc('check') })
  const publish = useMutation({
    mutationFn: (proposed: string) => rubricDoc('publish', proposed),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['rubric'] })
      await queryClient.invalidateQueries({ queryKey: ['rfps'] })
    },
  })

  const close = (next: boolean) => {
    if (publish.isPending) return
    onOpenChange(next)
    if (!next) {
      check.reset()
      publish.reset()
    }
  }

  const result = check.data
  const version = active.data?.version
  const proposedVersion = (version ?? 0) + 1
  const changes = result && 'problems' in result && result.current ? changesOnly(diffLines(result.current.content, result.proposed)) : []

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Rubric</DialogTitle>
          <DialogDescription>
            Fit reviews score against {version ? `version ${version}` : 'the published rubric'}. The team edits the rubric in a Google Doc; nothing changes until you publish it here.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1 text-sm">
          <a href={RUBRIC_DOC_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium underline underline-offset-4">
            Open the rubric Doc
            <ExternalLinkIcon className="size-3.5" aria-hidden />
          </a>

          {publish.data?.published && <p className="rounded-lg bg-muted/60 px-4 py-3">Published as version {publish.data.version}. New fit reviews use it. Reviews already done keep the version they used.</p>}
          {publish.data && !publish.data.published && <p className="rounded-lg bg-muted/60 px-4 py-3">The Doc already matches version {publish.data.version}. Nothing to publish.</p>}
          {check.error && <p className="text-destructive">{check.error.message}</p>}
          {publish.error && <p className="text-destructive">{publish.error.message}</p>}

          {!publish.data && result && 'error' in result && (
            <div className="space-y-2 rounded-lg bg-muted/60 px-4 py-3">
              <p className="font-medium">The app can't open the Doc yet.</p>
              <p>
                Share it with {result.serviceAccount ? <b className="font-semibold break-all">{result.serviceAccount}</b> : 'the Google service account'} as <b className="font-semibold">Viewer</b>, then check again.
              </p>
            </div>
          )}

          {!publish.data && result && 'problems' in result && result.problems.length > 0 && (
            <div className="space-y-2 rounded-lg border border-destructive/40 px-4 py-3">
              <p className="font-medium text-destructive">The Doc can't be published yet. Fix this in the Doc, then check again:</p>
              <ul className="list-disc space-y-1 pl-5">
                {result.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {!publish.data && result && 'problems' in result && result.problems.length === 0 && !result.changed && (
            <p className="rounded-lg bg-muted/60 px-4 py-3">The Doc matches version {result.current?.version}. Nothing to publish.</p>
          )}

          {!publish.data && result && 'problems' in result && result.problems.length === 0 && result.changed && (
            <div className="space-y-3">
              <p className="font-medium">{result.current ? `What changed from version ${result.current.version}` : 'The Doc, to be published as the first version'}</p>
              {result.current && changes.length > 0 ? (
                <ul className="space-y-1.5">
                  {changes.map((c, i) => (
                    <li key={i} className={cn('rounded-md px-3 py-2', c.kind === 'added' ? 'bg-green-50 dark:bg-green-950/40' : 'bg-red-50 dark:bg-red-950/40')}>
                      <p className="text-xs text-muted-foreground">{c.heading || 'Top of the Doc'}</p>
                      <p className={cn(c.kind === 'removed' && 'line-through opacity-80')}>
                        <span className="mr-2 font-semibold">{c.kind === 'added' ? '+' : '−'}</span>
                        {c.text.replace(/\*\*/g, '')}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="text-muted-foreground">Publishing makes this the rubric for new fit reviews. Reviews already done keep the version they used.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={publish.isPending} onClick={() => close(false)}>
            {publish.data ? 'Close' : 'Cancel'}
          </Button>
          {!publish.data && result && 'problems' in result && result.problems.length === 0 && result.changed ? (
            <Button disabled={publish.isPending} onClick={() => publish.mutate(result.proposed)}>
              {publish.isPending ? 'Publishing…' : `Publish as version ${proposedVersion}`}
            </Button>
          ) : (
            !publish.data && (
              <Button disabled={check.isPending} onClick={() => check.mutate()}>
                {check.isPending ? 'Checking…' : result ? 'Check again' : 'Check the Doc for changes'}
              </Button>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
