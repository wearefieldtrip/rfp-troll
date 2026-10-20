import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

type Props = { rfp: { id: string; title: string; client_name: string | null; due_date: string | null } }

export function EditRfpDialog({ rfp }: Props) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const save = useMutation({
    mutationFn: async (form: FormData) => {
      const text = (key: string) => ((form.get(key) as string) ?? '').trim() || null
      const dueDate = text('due_date')
      const { error } = await supabase
        .from('rfps')
        .update({
          title: text('title') ?? rfp.title,
          client_name: text('client_name'),
          due_date: dueDate,
          // A date someone typed is confirmed, not inferred.
          ...(dueDate !== rfp.due_date ? { due_date_source: dueDate ? 'manual' : null, due_date_evidence: null } : {}),
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
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Edit</DialogTrigger>
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
            <Input id="edit-due" name="due_date" type="date" defaultValue={rfp.due_date ?? ''} />
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
