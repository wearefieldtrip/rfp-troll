import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { teamQuery } from '@/lib/queries'
import { supabase } from '@/lib/supabase'

type Props = { rfpId: string; ownerId: string | null; open: boolean; onOpenChange: (open: boolean) => void }

export function ChangeOwnerDialog({ rfpId, ownerId, open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const team = useQuery(teamQuery)
  const [choice, setChoice] = useState<string | null>(null)
  const selected = choice ?? ownerId ?? ''

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('rfps').update({ owner_id: selected || null }).eq('id', rfpId)
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['rfps'] })
      onOpenChange(false)
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (save.isPending) return
        onOpenChange(next)
        if (!next) {
          setChoice(null)
          save.reset()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change owner</DialogTitle>
          <DialogDescription>The owner is the team member responsible for this RFP.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="owner">Owner</Label>
          <select
            id="owner"
            value={selected}
            onChange={(e) => setChoice(e.target.value)}
            className="h-9 w-full rounded-lg border bg-transparent px-3 text-sm"
          >
            <option value="">No owner</option>
            {team.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name ?? p.email}
              </option>
            ))}
          </select>
        </div>
        {save.error && <p className="text-sm text-destructive">Could not save. Please try again.</p>}
        <DialogFooter>
          <Button disabled={save.isPending || team.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
