import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

export function NewRfpDialog() {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (form: FormData) => {
      const text = (key: string) => (form.get(key) as string).trim() || null
      const { error } = await supabase.from('rfps').insert({
        title: text('title')!,
        client_name: text('client_name'),
        due_date: text('due_date'),
        source_url: text('source_url'),
      })
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['rfps'] })
      setOpen(false)
    },
  })

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    create.mutate(new FormData(e.currentTarget))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>New RFP</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New RFP</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client_name">Client</Label>
            <Input id="client_name" name="client_name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="due_date">Proposal due date</Label>
            <Input id="due_date" name="due_date" type="date" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="source_url">Link to RFP</Label>
            <Input id="source_url" name="source_url" type="url" placeholder="https://" />
          </div>
          {create.error && <p className="text-sm text-destructive">Could not save. Please try again.</p>}
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Saving…' : 'Add RFP'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
