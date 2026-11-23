import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { manualDayColumns } from '@/lib/moment-columns'
import { calendarDate, type Moment } from '@/lib/rfp-dates'
import { supabase } from '@/lib/supabase'

type Props = {
  rfp: {
    id: string
    title: string
    client_name: string | null
    proposal: Moment | null
  }
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditRfpDialog({ rfp, open, onOpenChange: setOpen }: Props) {
  const queryClient = useQueryClient()

  const save = useMutation({
    mutationFn: async (form: FormData) => {
      const text = (key: string) => ((form.get(key) as string) ?? '').trim() || null
      const dueDate = text('due_date')
      const currentDay = rfp.proposal ? calendarDate(rfp.proposal) : null

      const { error } = await supabase
        .from('rfps')
        .update({
          title: text('title') ?? rfp.title,
          client_name: text('client_name'),
          // A date someone typed is confirmed, not inferred.
          ...(dueDate !== currentDay ? { due_date_source: dueDate ? 'manual' : null, ...manualDayColumns('proposal_due', dueDate) } : {}),
        })
        .eq('id', rfp.id)
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['rfps'] })
      setOpen(false)
    },
  })

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    save.mutate(new FormData(e.currentTarget))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit details</DialogTitle>
          <DialogDescription>Changing the title or client here does not rename the Drive folder.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input id="edit-title" name="title" required defaultValue={rfp.title} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-client">Client</Label>
            <Input id="edit-client" name="client_name" defaultValue={rfp.client_name ?? ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-due">Proposal due date</Label>
            <Input id="edit-due" name="due_date" type="date" defaultValue={rfp.proposal ? calendarDate(rfp.proposal) : ''} />
          </div>
          {save.error && <p className="text-sm text-destructive">Could not save. Please try again.</p>}
          <DialogFooter>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
