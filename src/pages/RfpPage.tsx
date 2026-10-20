import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LoaderCircleIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { DecisionCard } from '@/components/DecisionCard'
import { ReviewSection } from '@/components/ReviewSection'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { syncRfpFolder } from '@/lib/functions'
import { rfpDocumentsQuery, rfpQuery } from '@/lib/queries'
import {
  ACCEPT_ATTR,
  formatBytes,
  isAcceptedFile,
  openRfpDocument,
  removeRfpDocument,
  uploadRfpFiles,
} from '@/lib/rfp-files'
import { STATUS_LABELS, STATUS_VARIANTS, type RfpStatus } from '@/lib/rfp-status'

const formatDate = (date: string | null) =>
  date ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : '—'

export default function RfpPage() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const rfp = useQuery(rfpQuery(id))
  const syncing = rfp.data?.drive_status === 'syncing'
  const documents = useQuery({ ...rfpDocumentsQuery(id), refetchInterval: syncing ? 2500 : false })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['rfps', id] })

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      await uploadRfpFiles(id, files)
      await syncRfpFolder(id).catch(() => undefined)
    },
    onSettled: refresh,
  })
  const retrySync = useMutation({ mutationFn: () => syncRfpFolder(id), onSettled: refresh })
  const remove = useMutation({ mutationFn: removeRfpDocument, onSettled: refresh })
  const open = useMutation({ mutationFn: openRfpDocument })

  const onPick = (files: FileList | null) => {
    const picked = Array.from(files ?? [])
    if (fileInput.current) fileInput.current.value = ''
    if (picked.length === 0) return
    const bad = picked.find((f) => !isAcceptedFile(f))
    setFileError(bad ? `${bad.name} isn't a supported file type.` : null)
    if (!bad) upload.mutate(picked)
  }

  if (rfp.isPending) return <Skeleton className="h-48 w-full max-w-3xl" />
  if (rfp.error) return <p className="text-destructive">Could not load this RFP.</p>

  const data = rfp.data
  const status = data.status as RfpStatus

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
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">Client</dt>
            <dd>{data.client_name ?? '—'}</dd>
            <dt className="text-muted-foreground">Proposal due</dt>
            <dd>{formatDate(data.due_date)}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Drive folder</CardTitle>
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

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Documents</CardTitle>
          <div>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={ACCEPT_ATTR}
              className="hidden"
              onChange={(e) => onPick(e.target.files)}
            />
            <Button variant="outline" size="sm" disabled={upload.isPending} onClick={() => fileInput.current?.click()}>
              {upload.isPending ? 'Uploading…' : 'Add documents'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          {upload.error && <p className="text-sm text-destructive">Upload failed. Please try again.</p>}
          {documents.isPending ? (
            <Skeleton className="h-10 w-full" />
          ) : documents.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents yet. Add the RFP to get a fit review.</p>
          ) : (
            documents.data?.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between gap-3 text-sm">
                <button type="button" className="truncate text-left text-primary hover:underline" onClick={() => open.mutate(doc)}>
                  {doc.file_name}
                </button>
                <div className="flex shrink-0 items-center gap-3 text-muted-foreground">
                  <span>{formatBytes(doc.size_bytes)}</span>
                  {doc.drive_file_id ? (
                    <span className="text-xs">In Drive</span>
                  ) : (
                    <Button variant="ghost" size="sm" disabled={remove.isPending} onClick={() => remove.mutate(doc)}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <ReviewSection rfpId={id} hasDocuments={(documents.data?.length ?? 0) > 0} />
      {status === 'evaluating' && <DecisionCard rfpId={id} />}
    </div>
  )
}
