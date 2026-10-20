import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { NewRfpDialog } from '@/components/NewRfpDialog'
import { rfpsQuery } from '@/lib/queries'
import { STATUS_LABELS, STATUS_VARIANTS, type RfpStatus } from '@/lib/rfp-status'

const formatDate = (date: string | null) =>
  date ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

export default function HomePage() {
  const { data: rfps, isPending, error } = useQuery(rfpsQuery)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">RFPs</h1>
        <NewRfpDialog />
      </div>

      {isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : error ? (
        <p className="text-destructive">Could not load RFPs.</p>
      ) : rfps.length === 0 ? (
        <p className="text-muted-foreground">No RFPs yet. Add one to get started.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rfps.map((rfp) => {
              const status = rfp.status as RfpStatus
              return (
                <TableRow key={rfp.id}>
                  <TableCell className="font-medium">{rfp.title}</TableCell>
                  <TableCell>{rfp.client_name ?? '—'}</TableCell>
                  <TableCell>{formatDate(rfp.due_date)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
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
