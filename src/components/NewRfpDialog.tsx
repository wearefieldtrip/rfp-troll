import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { syncRfpFolder } from '@/lib/functions'
import { ACCEPT_ATTR, isAcceptedFile, uploadRfpFiles } from '@/lib/rfp-files'
import { supabase } from '@/lib/supabase'

const titleFromFileName = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim() || 'New RFP'

export function NewRfpDialog() {
  const [open, setOpen] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const create = useMutation({
    mutationFn: async (file: File) => {
      // The title is provisional; it is replaced with the real one read from the RFP.
      const { data, error } = await supabase
        .from('rfps')
        .insert({ title: titleFromFileName(file.name), extract_status: 'pending' })
        .select('id')
        .single()
      if (error) throw error

      // The RFP exists even if an upload or the Drive step fails; its page shows the state and lets them retry.
      await uploadRfpFiles(data.id, [file]).catch(() => undefined)
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
    const file = new FormData(e.currentTarget).get('file') as File | null
    if (!file || file.size === 0) {
      setFileError('Choose the RFP to upload.')
      return
    }
    if (!isAcceptedFile(file)) {
      setFileError(`${file.name} isn't a supported file type.`)
      return
    }
    setFileError(null)
    create.mutate(file)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>New RFP</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New RFP</DialogTitle>
          <DialogDescription>
            The title, client and due date are read from the RFP, and its Drive folder is created for you.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">Upload RFP</Label>
            <Input id="file" name="file" type="file" accept={ACCEPT_ATTR} />
            <p className="text-xs text-muted-foreground">PDF, Word (.docx), text or Markdown. Up to 50 MB.</p>
          </div>
          {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          {create.error && <p className="text-sm text-destructive">Could not save. Please try again.</p>}
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Uploading…' : 'Add RFP'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
