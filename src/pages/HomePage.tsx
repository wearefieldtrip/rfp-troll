import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { FitBadge } from '@/components/FitBadge'
import { NewRfpDialog } from '@/components/NewRfpDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { rfpsQuery } from '@/lib/queries'
import { cleanBandLabel, MAX_TOTAL } from '@/lib/rubric-structure'
import { ACTIVE_STATUSES, statusLabel, statusVariant } from '@/lib/rfp-status'

const VIEWS = [
  { key: 'active', label: 'Active', statuses: ACTIVE_STATUSES as readonly string[] },
  { key: 'won', label: 'Won', statuses: ['closed_won'] },
  { key: 'lost', label: 'Lost', statuses: ['closed_lost'] },
  { key: 'passed', label: 'Passed', statuses: ['closed_passed'] },
  { key: 'all', label: 'All', statuses: null },
] as const

const EMPTY_TEXT: Record<string, string> = {
  active: 'No active RFPs. Add one to get started.',
  won: 'No won RFPs yet.',
  lost: 'No lost RFPs yet.',
  passed: 'No passed RFPs yet. RFPs you pass on are kept here.',
  all: 'No RFPs yet. Add one to get started.',
}

const formatDate = (date: string | null) =>
  date ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

export default function HomePage() {
  const { data: rfps, isPending, error } = useQuery(rfpsQuery)
  const [params, setParams] = useSearchParams()
  const view = VIEWS.find((v) => v.key === params.get('view')) ?? VIEWS[0]

  const inView = (status: string, statuses: readonly string[] | null) => !statuses || statuses.includes(status)
  const visible = rfps?.filter((r) => inView(r.status, view.statuses)) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">RFPs</h1>
        <NewRfpDialog />
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="RFP status">
        {VIEWS.map((v) => {
          const count = rfps?.filter((r) => inView(r.status, v.statuses)).length
          const selected = v.key === view.key
          return (
            <Button
              key={v.key}
              role="tab"
              aria-selected={selected}
              size="sm"
              variant={selected ? 'secondary' : 'ghost'}
              onClick={() => setParams(v.key === 'active' ? {} : { view: v.key })}
            >
              {v.label}
              {count !== undefined && <span className="ml-1 text-muted-foreground">{count}</span>}
            </Button>
          )
        })}
      </div>

      {isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : error ? (
        <p className="text-destructive">Could not load RFPs.</p>
      ) : visible.length === 0 ? (
        <p className="text-muted-foreground">{EMPTY_TEXT[view.key]}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Fit</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((rfp) => {
              // The most recent completed fit review, if any.
              const review = rfp.rfp_reviews
                .filter((r) => r.status === 'complete')
                .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
              return (
                <TableRow key={rfp.id}>
                  <TableCell className="font-medium">
                    <Link to={`/rfps/${rfp.id}`} className="hover:underline">
                      {rfp.title}
                    </Link>
                  </TableCell>
                  <TableCell>{rfp.client_name ?? '—'}</TableCell>
                  <TableCell>{formatDate(rfp.due_date)}</TableCell>
                  <TableCell>
                    {review ? (
                      <FitBadge band={cleanBandLabel(review.decision_band)} total={review.total_score} max={MAX_TOTAL} showScore />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(rfp.status)}>{statusLabel(rfp.status)}</Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
