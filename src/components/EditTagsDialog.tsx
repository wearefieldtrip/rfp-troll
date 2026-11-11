import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { rfpTagsQuery, tagValuesQuery } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { planTagSave, toggleChoice, type CurrentTag } from '@/lib/tag-edit'
import { TAG_GROUPS, valuesOf } from '@/lib/tag-groups'
import { cn } from '@/lib/utils'

type Props = { rfpId: string; open: boolean; onOpenChange: (open: boolean) => void }

function TagsForm({ rfpId, onDone }: { rfpId: string; onDone: () => void }) {
  const queryClient = useQueryClient()
  const values = useQuery(tagValuesQuery)
  const tags = useQuery(rfpTagsQuery(rfpId))

  const current: CurrentTag[] = (tags.data ?? []).flatMap((t) =>
    t.tag_values ? [{ id: t.id, tag_value_id: t.tag_value_id, tag_group: t.tag_values.tag_group, confirmed: t.confirmed }] : [],
  )
  // Starts from what is stored; only mounted once the tags have loaded, so this is read once.
  const [selected, setSelected] = useState(() => new Map(TAG_GROUPS.map((g) => [g.key as string, new Set(current.filter((c) => c.tag_group === g.key).map((c) => c.tag_value_id))])))

  const save = useMutation({
    mutationFn: async () => {
      const plan = planTagSave(current, selected)
      const { data: userData } = await supabase.auth.getUser()
      const by = userData.user?.id

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
                {valuesOf(values.data ?? [], group.key).map((v) => {
                  const on = chosen.has(v.id)
                  return (
                    <button
                      key={v.id}
                      type="button"
                      aria-pressed={on}
                      disabled={save.isPending}
                      onClick={() => setSelected(new Map(selected).set(group.key, toggleChoice(chosen, v.id, group.many)))}
                      className={cn('rounded-full border px-2.5 py-0.5 text-sm transition-colors', on ? 'border-foreground bg-foreground text-background' : 'hover:bg-muted')}
                    >
                      {v.value}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          )
        })}
      </div>
      {save.error && <p className="text-sm text-destructive">Could not save the tags. Please try again.</p>}
      <DialogFooter>
        <Button variant="outline" disabled={save.isPending} onClick={onDone}>
          Cancel
        </Button>
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </>
  )
}

/** Tags are stored, not shown on the profile. This is where a person looks at them and fixes a wrong one. */
export function EditTagsDialog({ rfpId, open, onOpenChange }: Props) {
  const values = useQuery(tagValuesQuery)
  const tags = useQuery(rfpTagsQuery(rfpId))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit tags</DialogTitle>
          <DialogDescription>
            These help find similar past RFPs. The AI sets them when it reviews. A group you change is kept as you set it, even if the review runs again.
          </DialogDescription>
        </DialogHeader>
        {values.isPending || tags.isPending ? <Skeleton className="h-48 w-full" /> : <TagsForm rfpId={rfpId} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}
