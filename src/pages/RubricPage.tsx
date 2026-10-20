import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RubricEditor } from '@/components/RubricEditor'
import { Markdown } from '@/components/Markdown'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { rubricQuery, rubricVersionsQuery } from '@/lib/queries'

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

export default function RubricPage() {
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState(false)
  const versionId = params.get('v') ?? undefined

  const versions = useQuery(rubricVersionsQuery)
  const { data: rubric, isPending, error } = useQuery(rubricQuery(versionId))

  const selectVersion = (id: string, isActive: boolean) => setParams(isActive ? {} : { v: id })

  if (isPending) return <Skeleton className="h-64 w-full max-w-3xl" />
  if (error) return <p className="text-destructive">Could not load the rubric.</p>

  const current = versions.data?.find((v) => v.id === rubric.id)
  const author = current?.profiles?.full_name ?? current?.profiles?.email

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Rubric</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Version {rubric.version}
            {rubric.is_active ? ' (current)' : ''}
            {current && ` · saved ${formatDate(current.created_at)}${author ? ` by ${author}` : ''}`}
          </p>
        </div>
        {!editing && (
          <div className="flex items-center gap-2">
            {versions.data && versions.data.length > 1 && (
              <select
                aria-label="Rubric version"
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                value={rubric.id}
                onChange={(e) => {
                  const picked = versions.data.find((v) => v.id === e.target.value)
                  if (picked) selectVersion(picked.id, picked.is_active)
                }}
              >
                {versions.data.map((v) => (
                  <option key={v.id} value={v.id}>
                    Version {v.version}
                    {v.is_active ? ' (current)' : ''}
                  </option>
                ))}
              </select>
            )}
            <Button onClick={() => setEditing(true)}>{rubric.is_active ? 'Edit' : 'Restore as new version'}</Button>
          </div>
        )}
      </div>

      {editing ? (
        <RubricEditor
          key={rubric.id}
          rubric={rubric}
          onDone={() => {
            setEditing(false)
            setParams({})
          }}
        />
      ) : (
        <Markdown>{rubric.content}</Markdown>
      )}
    </div>
  )
}
