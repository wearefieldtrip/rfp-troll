import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LoaderCircleIcon } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { DecisionCard } from '@/components/DecisionCard'
import { DeleteRfpDialog } from '@/components/DeleteRfpDialog'
import { EditRfpDialog } from '@/components/EditRfpDialog'
import { ReviewSection } from '@/components/ReviewSection'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { syncRfpFolder } from '@/lib/functions'
import { asKeyDates, formatLongDate } from '@/lib/key-dates'
import { rfpDocumentsQuery, rfpQuery, rfpReviewsQuery } from '@/lib/queries'
import { STATUS_LABELS, STATUS_VARIANTS, type RfpStatus } from '@/lib/rfp-status'

export default function RfpPage() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()

  const rfp = useQuery(rfpQuery(id))
  const syncing = rfp.data?.drive_status === 'syncing'
  const documents = useQuery({ ...rfpDocumentsQuery(id), refetchInterval: syncing ? 2500 : false })
  const reviews = useQuery(rfpReviewsQuery(id))
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['rfps', id] })

  const retrySync = useMutation({ mutationFn: () => syncRfpFolder(id), onSettled: refresh })

  if (rfp.isPending) return <Skeleton className="h-48 w-full max-w-3xl" />
  if (rfp.error) return <p className="text-destructive">Could not load this RFP.</p>

  const data = rfp.data
  const status = data.status as RfpStatus
  const keyDates = asKeyDates(data.key_dates)
  const reading = data.extract_status === 'pending' && data.drive_status === 'syncing'

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:underline">
          ← All RFPs
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{data.title}</h1>
          <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardAction>
            <EditRfpDialog rfp={{ id, title: data.title, client_name: data.client_name, due_date: data.due_date }} />
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
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">Client</dt>
            <dd>{data.client_name ?? '—'}</dd>
            <dt className="text-muted-foreground">Proposal due</dt>
            <dd>
              {data.due_date ? formatLongDate(data.due_date) : '—'}
              {data.due_date && data.due_date_source === 'inferred' && (
                <Badge variant="outline" className="ml-2">
                  From the RFP
                </Badge>
              )}
              {data.due_date_source === 'inferred' && data.due_date_evidence && (
                <span className="mt-1 block text-xs text-muted-foreground italic">{data.due_date_evidence}</span>
              )}
            </dd>
          </dl>
          {keyDates.length > 0 && (
            <div className="space-y-1 border-t pt-3 text-sm">
              <p className="font-medium">Other dates in the RFP</p>
              <dl className="grid grid-cols-[8rem_1fr] gap-y-1">
                {keyDates.map((d) => (
                  <div key={`${d.label}-${d.date}`} className="contents">
                    <dt className="text-muted-foreground">{d.label}</dt>
                    <dd>
                      {d.date ? formatLongDate(d.date) : <span className="text-muted-foreground italic">{d.evidence}</span>}
                      {d.date && d.time ? `, ${d.time}` : ''}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Drive folder</CardTitle>
          <CardAction>
            {data.drive_status === 'ready' && data.drive_folder_url && (
              <Button size="sm" variant="outline" render={<a href={data.drive_folder_url} target="_blank" rel="noreferrer" />}>
                Open in Drive
              </Button>
            )}
            {(data.drive_status === 'pending' || data.drive_status === 'failed') && (
              <Button size="sm" variant="outline" disabled={retrySync.isPending} onClick={() => retrySync.mutate()}>
                {data.drive_status === 'failed' ? 'Retry' : 'Create folder'}
              </Button>
            )}
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {data.drive_status === 'syncing' && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
              Setting up the folder in Drive…
            </p>
          )}
          {data.drive_status === 'ready' && (
            <p className="text-muted-foreground">
              Business Development / Prospective Clients. Everything for this RFP lives in this folder.
            </p>
          )}
          {data.drive_status === 'pending' && <p className="text-muted-foreground">No Drive folder yet.</p>}
          {data.drive_status === 'failed' && <p className="text-destructive">{data.drive_error ?? 'The folder could not be created.'}</p>}
          {retrySync.error && <p className="text-destructive">{retrySync.error.message}</p>}
        </CardContent>
      </Card>

      <ReviewSection rfpId={id} hasDocuments={(documents.data?.length ?? 0) > 0} />
      {status === 'evaluating' && (
        <DecisionCard rfpId={id} enabled={reviews.data?.some((r) => r.status === 'complete') ?? false} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Delete RFP</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">Permanently remove this RFP from RFP Buddy.</p>
          <DeleteRfpDialog
            rfp={{ id, title: data.title, drive_folder_id: data.drive_folder_id }}
            documentCount={documents.data?.length ?? 0}
            reviewCount={reviews.data?.length ?? 0}
          />
        </CardContent>
      </Card>
    </div>
  )
}
