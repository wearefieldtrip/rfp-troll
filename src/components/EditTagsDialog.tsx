import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { XIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { rfpTagsQuery, tagUsageQuery, tagValuesQuery } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { planTagSave, toggleChoice, type CurrentTag } from '@/lib/tag-edit'
import { canRemove, cleanValue, hasValue, TAG_GROUPS, valuesOf, type TagGroupKey } from '@/lib/tag-groups'
import { cn } from '@/lib/utils'

type Props = { rfpId: string; /** A past RFP from the tracker: editing its tags counts as reviewing it, so a re-run of the import leaves it alone. */ imported?: boolean; open: boolean; onOpenChange: (open: boolean) => void }

function TagsForm({ rfpId, imported, onDone }: { rfpId: string; imported: boolean; onDone: () => void }) {
  const queryClient = useQueryClient()
  const values = useQuery(tagValuesQuery)
  const tags = useQuery(rfpTagsQuery(rfpId))

  const current: CurrentTag[] = (tags.data ?? []).flatMap((t) =>
    t.tag_values ? [{ id: t.id, tag_value_id: t.tag_value_id, tag_group: t.tag_values.tag_group, confirmed: t.confirmed }] : [],
  )
  // Starts from what is stored; only mounted once the tags have loaded, so this is read once.
  const [selected, setSelected] = useState(() => new Map(TAG_GROUPS.map((g) => [g.key as string, new Set(current.filter((c) => c.tag_group === g.key).map((c) => c.tag_value_id))])))

  const usage = useQuery(tagUsageQuery)
  const [managing, setManaging] = useState(false)
  const [newText, setNewText] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const refreshValues = () => queryClient.invalidateQueries({ queryKey: ['tags'] })

  // A new value joins the list for everyone and is chosen for this RFP.
  const addValue = useMutation({
    mutationFn: async ({ group, value }: { group: TagGroupKey; value: string }) => {
      const { data, error } = await supabase.from('tag_values').insert({ tag_group: group, value }).select('id').single()
      if (error || !data) throw error ?? new Error('No row')
      return { group, id: data.id }
    },
    onSuccess: async ({ group, id }) => {
      setNewText((t) => ({ ...t, [group]: '' }))
      const many = TAG_GROUPS.find((g) => g.key === group)?.many ?? false
      setSelected((sel) => new Map(sel).set(group, toggleChoice(sel.get(group) ?? new Set(), id, many)))
      await refreshValues()
    },
    onError: () => setProblem('Could not add that value. Please try again.'),
  })

  // Only a value no RFP carries can be deleted, so no other RFP loses a tag.
  const removeValue = useMutation({
    mutationFn: async ({ id }: { id: string; group: string }) => {
      const { error } = await supabase.from('tag_values').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: async (_, { id, group }) => {
      setSelected((sel) => {
        const next = new Set(sel.get(group))
        next.delete(id)
        return new Map(sel).set(group, next)
      })
      await refreshValues()
    },
    onError: () => setProblem('Could not delete that value. Please try again.'),
  })

  const submitNew = (e: FormEvent, group: TagGroupKey) => {
    e.preventDefault()
    const value = cleanValue(newText[group] ?? '')
    if (!value) return
    if (hasValue(values.data ?? [], group, value)) return setProblem('That value is already in the list.')
    setProblem(null)
    addValue.mutate({ group, value })
  }

  const save = useMutation({
    mutationFn: async () => {
      const plan = planTagSave(current, selected)
      const { data: userData } = await supabase.auth.getUser()
      const by = userData.user?.id

      // A value the AI suggested joins the list once someone chooses it.
      const chosenIds = new Set([...selected.values()].flatMap((set) => [...set]))
      const toApprove = (values.data ?? []).filter((v) => v.status === 'suggested' && chosenIds.has(v.id)).map((v) => v.id)
      if (toApprove.length > 0) {
        const { error } = await supabase.from('tag_values').update({ status: 'approved' }).in('id', toApprove)
        if (error) throw error
      }
      if (plan.removeIds.length > 0) {
        const { error } = await supabase.from('rfp_tags').delete().in('id', plan.removeIds)
        if (error) throw error
      }
      if (plan.addValueIds.length > 0) {
        const rows = plan.addValueIds.map((tag_value_id) => ({ rfp_id: rfpId, tag_value_id, source: 'person', confirmed: true, updated_by: by }))
        const { error } = await supabase.from('rfp_tags').insert(rows)
        if (error) throw error
      }
      if (plan.confirmIds.length > 0) {
        const { error } = await supabase.from('rfp_tags').update({ confirmed: true, updated_by: by, updated_at: new Date().toISOString() }).in('id', plan.confirmIds)
        if (error) throw error
      }
      if (imported && plan.changedGroups.length > 0) {
        const { error } = await supabase.from('rfps').update({ import_reviewed: true }).eq('id', rfpId)
        if (error) throw error
        await queryClient.invalidateQueries({ queryKey: ['rfps'] })
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['rfps', rfpId, 'tags'] })
      await queryClient.invalidateQueries({ queryKey: ['tags'] })
      onDone()
    },
  })

  return (
    <>
      <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
        {TAG_GROUPS.map((group) => {
          const chosen = selected.get(group.key) ?? new Set<string>()
          const fromAi = current.some((c) => c.tag_group === group.key && !c.confirmed)
          return (
            <fieldset key={group.key} className="space-y-2">
              <legend className="text-sm font-medium">
                {group.label}
                <span className="ml-2 font-normal text-muted-foreground">
                  {group.many ? 'any number' : 'one'}
                  {fromAi && ' · AI suggested'}
                </span>
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {[...valuesOf(values.data ?? [], group.key), ...valuesOf(values.data ?? [], group.key, 'suggested')].map((v) => {
                  const on = chosen.has(v.id)
                  const used = usage.data?.get(v.id) ?? 0
                  const deletable = managing && canRemove(v, used)
                  return (
                    <span key={v.id} className="inline-flex items-center">
                      <button
                        type="button"
                        aria-pressed={on}
                        disabled={save.isPending || managing}
                        onClick={() => setSelected(new Map(selected).set(group.key, toggleChoice(chosen, v.id, group.many)))}
                        title={v.status === 'suggested' ? 'Suggested by the AI. Choosing it adds it to the list.' : undefined}
                        className={cn(
                          'rounded-full border px-2.5 py-0.5 text-sm transition-colors',
                          on ? 'border-foreground bg-foreground text-background' : 'hover:bg-muted',
                          v.status === 'suggested' && !on && 'border-dashed',
                          deletable && 'rounded-r-none border-r-0',
                        )}
                      >
                        {v.value}
                        {managing && used > 0 && <span className="ml-1.5 text-muted-foreground">{used}</span>}
                      </button>
                      {deletable && (
                        <button
                          type="button"
                          aria-label={`Delete ${v.value}`}
                          disabled={removeValue.isPending}
                          onClick={() => removeValue.mutate({ id: v.id, group: group.key })}
                          className="rounded-full rounded-l-none border border-l-0 px-1.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <XIcon className="size-3" aria-hidden />
                        </button>
                      )}
                    </span>
                  )
                })}
              </div>
              {!managing && group.key !== 'budget_band' && (
                <form onSubmit={(e) => submitNew(e, group.key)} className="flex gap-2">
                  <Input
                    value={newText[group.key] ?? ''}
                    onChange={(e) => setNewText({ ...newText, [group.key]: e.target.value })}
                    placeholder="Add a new value"
                    aria-label={`New ${group.label} value`}
                    className="h-7 max-w-xs text-sm"
                    disabled={addValue.isPending}
                  />
                  <Button type="submit" size="sm" variant="outline" disabled={!cleanValue(newText[group.key] ?? '') || addValue.isPending}>
                    Add
                  </Button>
                </form>
              )}
            </fieldset>
          )
        })}
      </div>
      {problem && <p className="text-sm text-destructive">{problem}</p>}
      {save.error && <p className="text-sm text-destructive">Could not save the tags. Please try again.</p>}
      <DialogFooter className="sm:justify-between">
        <Button type="button" variant="ghost" disabled={save.isPending} onClick={() => setManaging(!managing)}>
          {managing ? 'Done deleting' : 'Delete values'}
        </Button>
        <span className="flex gap-2">
        <Button variant="outline" disabled={save.isPending} onClick={onDone}>
          Cancel
        </Button>
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
        </span>
      </DialogFooter>
    </>
  )
}

/** Tags are stored, not shown on the profile. This is where a person looks at them and fixes a wrong one. */
export function EditTagsDialog({ rfpId, imported = false, open, onOpenChange }: Props) {
  const values = useQuery(tagValuesQuery)
  const tags = useQuery(rfpTagsQuery(rfpId))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit tags</DialogTitle>
          <DialogDescription>
            These help find similar past RFPs. The AI sets them when it reviews. A group you change is kept as you set it, even if the review runs again. Add a value if the one you need isn't there; Delete values removes ones no RFP uses.
          </DialogDescription>
        </DialogHeader>
        {values.isPending || tags.isPending ? <Skeleton className="h-48 w-full" /> : <TagsForm rfpId={rfpId} imported={imported} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}
