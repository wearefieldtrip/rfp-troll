import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { OUTCOME_LABELS } from '@/lib/import-view'
import { importedRfpsQuery } from '@/lib/queries'
import { reviewReasons } from '@/lib/review-imports'

const trackerRow = (data: unknown) => ((data as { tracker_row?: number } | null)?.tracker_row ?? 0)

export default function ReviewImportsPage() {
  const { data, isPending, error } = useQuery(importedRfpsQuery)
  const [tab, setTab] = useState<'todo' | 'done'>('todo')

  if (isPending) return <Skeleton className="h-64 w-full max-w-3xl" />
  if (error) return <p className="text-destructive">Could not load the imported RFPs.</p>

  const rows = data
    .map((r) => ({ ...r, reasons: reviewReasons({ ...r, rfp_tags: r.rfp_tags ?? [] }) }))
    // Those with something to check come first, then in the tracker's own order.
    .sort((a, b) => Number(b.reasons.length > 0) - Number(a.reasons.length > 0) || trackerRow(a.import_data) - trackerRow(b.import_data))
  const todo = rows.filter((r) => !r.import_reviewed)
  const done = rows.filter((r) => r.import_reviewed)
  const shown = tab === 'todo' ? todo : done
  const needAttention = todo.filter((r) => r.reasons.length > 0).length

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Review imports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Past RFPs from the tracker. Open one to fix its outcome or tags, then mark it reviewed. Reviewed RFPs are left alone when the import runs again.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Review status">
        <Button role="tab" aria-selected={tab === 'todo'} size="sm" variant={tab === 'todo' ? 'secondary' : 'ghost'} onClick={() => setTab('todo')}>
          To review ({todo.length})
        </Button>
        <Button role="tab" aria-selected={tab === 'done'} size="sm" variant={tab === 'done' ? 'secondary' : 'ghost'} onClick={() => setTab('done')}>
          Reviewed ({done.length})
        </Button>
      </div>

      {tab === 'todo' && todo.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {needAttention > 0 ? `${needAttention} of ${todo.length} have something to check. The rest only need you to look them over.` : 'Nothing is flagged. Look them over and mark them reviewed.'}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tab === 'todo' ? 'Nothing to review.' : 'Nothing reviewed yet.'}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {shown.map((r) => (
            <li key={r.id}>
              <Link to={`/rfps/${r.id}`} className="block space-y-1 px-3 py-2.5 hover:bg-muted/50">
                <span className="flex flex-wrap items-baseline gap-x-3">
                  <span className="min-w-0 flex-1 font-medium break-words">{r.client_name ?? r.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {r.submission_year ?? '—'} · {r.outcome ? (OUTCOME_LABELS[r.outcome] ?? r.outcome) : '—'}
                  </span>
                </span>
                {r.reasons.length > 0 && (
                  <span className="flex flex-wrap gap-1.5">
                    {r.reasons.map((reason) => (
                      <Badge key={reason} variant="outline" className="h-auto whitespace-normal py-0.5 font-normal">
                        {reason}
                      </Badge>
                    ))}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
