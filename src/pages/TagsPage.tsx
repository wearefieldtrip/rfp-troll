import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { XIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { tagUsageQuery, tagValuesQuery } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { canRemove, cleanValue, hasValue, isTagGroup, TAG_GROUPS, valuesOf, type TagGroupKey } from '@/lib/tag-groups'

function AddValue({ group, existing }: { group: TagGroupKey; existing: Parameters<typeof hasValue>[0] }) {
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  const add = useMutation({
    mutationFn: async (value: string) => {
      const { error } = await supabase.from('tag_values').insert({ tag_group: group, value })
      if (error) throw error
    },
    onSuccess: async () => {
      setText('')
      await queryClient.invalidateQueries({ queryKey: ['tags'] })
    },
    onError: () => setProblem('Could not add that value. Please try again.'),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const value = cleanValue(text)
    if (!value) return
    if (hasValue(existing, group, value)) return setProblem('That value is already in the list.')
    setProblem(null)
    add.mutate(value)
  }

  return (
    <form onSubmit={submit} className="space-y-1">
      <div className="flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a value" aria-label="New value" className="max-w-xs" disabled={add.isPending} />
        <Button type="submit" size="sm" variant="outline" disabled={!cleanValue(text) || add.isPending}>
          Add
        </Button>
      </div>
      {problem && <p className="text-sm text-destructive">{problem}</p>}
    </form>
  )
}

export default function TagsPage() {
  const queryClient = useQueryClient()
  const values = useQuery(tagValuesQuery)
  const usage = useQuery(tagUsageQuery)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['tags'] })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tag_values').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: refresh,
  })
  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tag_values').update({ status: 'approved' }).eq('id', id)
      if (error) throw error
    },
    onSettled: refresh,
  })

  if (values.isPending || usage.isPending) return <Skeleton className="h-64 w-full max-w-3xl" />
  if (values.error || usage.error) return <p className="text-destructive">Could not load the tags.</p>

  const all = values.data
  const suggested = all.filter((v) => v.status === 'suggested' && isTagGroup(v.tag_group))
  const labelOf = (group: string) => TAG_GROUPS.find((g) => g.key === group)?.label ?? group

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tags</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The lists every RFP is tagged from. The AI picks from these and may suggest a new value, which joins a list only when you approve it here.
        </p>
      </div>

      {suggested.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Suggested by the AI</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {suggested.map((v) => (
              <div key={v.id} className="flex flex-wrap items-center gap-3">
                <span className="font-medium">{v.value}</span>
                <span className="text-muted-foreground">{labelOf(v.tag_group)}</span>
                <span className="ml-auto flex gap-2">
                  <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(v.id)}>
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" disabled={remove.isPending} onClick={() => remove.mutate(v.id)}>
                    Reject
                  </Button>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {TAG_GROUPS.map((group) => {
        const approved = valuesOf(all, group.key)
        return (
          <Card key={group.key}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-baseline gap-x-3">
                {group.label}
                <span className="text-sm font-normal text-muted-foreground">
                  {group.answers} · {group.many ? 'many per RFP' : 'one per RFP'}
                  {group.automatic && ' · filled in from the RFP'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="flex flex-wrap gap-2">
                {approved.map((v) => {
                  const used = usage.data.get(v.id) ?? 0
                  return (
                    <li key={v.id}>
                      <Badge variant="secondary" className="h-6 gap-1.5 pr-1.5 text-sm">
                        {v.value}
                        {used > 0 && <span className="text-muted-foreground">{used}</span>}
                        {canRemove(v, used) && (
                          <button
                            type="button"
                            aria-label={`Remove ${v.value}`}
                            disabled={remove.isPending}
                            onClick={() => remove.mutate(v.id)}
                            className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                          >
                            <XIcon className="size-3" aria-hidden />
                          </button>
                        )}
                      </Badge>
                    </li>
                  )
                })}
              </ul>
              {group.key !== 'budget_band' && <AddValue group={group.key} existing={all} />}
            </CardContent>
          </Card>
        )
      })}
      {(remove.error || approve.error) && <p className="text-sm text-destructive">That change did not save. Please try again.</p>}
    </div>
  )
}
