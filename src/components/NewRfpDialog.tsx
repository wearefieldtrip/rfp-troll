import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { syncRfpFolder } from '@/lib/functions'
import { ACCEPT_ATTR, isAcceptedFile, uploadRfpFiles } from '@/lib/rfp-files'
import { supabase } from '@/lib/supabase'

export function NewRfpDialog() {
  const [open, setOpen] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const create = useMutation({
    mutationFn: async (form: FormData) => {
      const text = (key: string) => ((form.get(key) as string) ?? '').trim() || null
      const files = (form.getAll('files') as File[]).filter((f) => f.size > 0)

      const { data, error } = await supabase
        .from('rfps')
        .insert({
          title: text('title')!,
          client_name: text('client_name'),
          due_date: text('due_date'),
          source_url: text('source_url'),
        })
        .select('id')
        .single()
      if (error) throw error

      // The RFP exists even if an upload or the Drive step fails; its page shows the state and lets them retry.
      await uploadRfpFiles(data.id, files).catch(() => undefined)
      await syncRfpFolder(data.id).catch(() => undefined)
      return data.id
    },
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: ['rfps'] })
      setOpen(false)
      navigate(`/rfps/${id}`)
    },
  })

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const bad = (form.getAll('files') as File[]).find((f) => f.size > 0 && !isAcceptedFile(f))
    if (bad) {
      setFileError(`${bad.name} isn't a supported file type.`)
      return
    }
    setFileError(null)
    create.mutate(form)
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
          <div className="space-y-2">
            <Label htmlFor="files">RFP documents</Label>
            <Input id="files" name="files" type="file" multiple accept={ACCEPT_ATTR} />
            <p className="text-xs text-muted-foreground">PDF, Word (.docx), text or Markdown. Up to 50 MB each.</p>
          </div>
          {fileError && <p className="text-sm text-destructive">{fileError}</p>}
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
