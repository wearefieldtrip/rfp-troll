import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LoaderCircleIcon } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { DecisionCard } from '@/components/DecisionCard'
import { DeleteRfpDialog } from '@/components/DeleteRfpDialog'
import { EditRfpDialog } from '@/components/EditRfpDialog'
import { KeyFacts } from '@/components/KeyFacts'
import { ReviewSection } from '@/components/ReviewSection'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { syncRfpFolder } from '@/lib/functions'
import { rfpDocumentsQuery, rfpQuery, rfpReviewsQuery } from '@/lib/queries'
import { statusLabel, statusVariant } from '@/lib/rfp-status'

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
  const status = data.status
  const reading = data.extract_status === 'pending' && data.drive_status === 'syncing'

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:underline">
          ← All RFPs
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{data.title}</h1>
          <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
        </div>
      </div>

      <KeyFacts rfp={data} reading={reading} onRetryDrive={() => retrySync.mutate()} retryingDrive={retrySync.isPending} />
      {retrySync.error && <p className="text-sm text-destructive">{retrySync.error.message}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardAction>
            <EditRfpDialog
              rfp={{
                id,
                title: data.title,
                client_name: data.client_name,
                due_date: data.due_date,
                budget_min_usd: data.budget_min_usd,
                budget_max_usd: data.budget_max_usd,
                budget_qualifier: data.budget_qualifier,
              }}
            />
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
          <dl className="grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">Client</dt>
            <dd>{data.client_name ?? '—'}</dd>
          </dl>
        </CardContent>
      </Card>

      <ReviewSection rfpId={id} hasDocuments={(documents.data?.length ?? 0) > 0} />
      {status === 'evaluate_ready' && (
        <DecisionCard rfpId={id} enabled={reviews.data?.some((r) => r.status === 'complete') ?? false} />
      )}

      <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40">
        <CardHeader>
          <CardTitle className="text-red-900 dark:text-red-200">Delete RFP</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm text-red-900/80 dark:text-red-200/80">Permanently remove this RFP from RFP Troll.</p>
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
