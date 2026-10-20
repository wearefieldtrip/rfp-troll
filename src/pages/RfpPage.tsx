import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DecisionCard } from '@/components/DecisionCard'
import { ReviewSection } from '@/components/ReviewSection'
import { Skeleton } from '@/components/ui/skeleton'
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
  const documents = useQuery(rfpDocumentsQuery(id))
  const refreshDocuments = () => queryClient.invalidateQueries({ queryKey: ['rfps', id, 'documents'] })

  const upload = useMutation({
    mutationFn: (files: File[]) => uploadRfpFiles(id, files),
    onSettled: refreshDocuments,
  })
  const remove = useMutation({ mutationFn: removeRfpDocument, onSettled: refreshDocuments })
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
            <dt className="text-muted-foreground">Link</dt>
            <dd>
              {data.source_url ? (
                <a href={data.source_url} target="_blank" rel="noreferrer" className="text-primary underline">
                  {data.source_url}
                </a>
              ) : (
                '—'
              )}
            </dd>
          </dl>
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
                <button type="button" className="truncate text-left text-primary hover:underline" onClick={() => open.mutate(doc.storage_path)}>
                  {doc.file_name}
                </button>
                <div className="flex shrink-0 items-center gap-3 text-muted-foreground">
                  <span>{formatBytes(doc.size_bytes)}</span>
                  <Button variant="ghost" size="sm" disabled={remove.isPending} onClick={() => remove.mutate(doc)}>
                    Remove
                  </Button>
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
