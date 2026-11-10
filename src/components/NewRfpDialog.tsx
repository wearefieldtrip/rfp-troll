import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileTextIcon, LoaderCircleIcon, UploadIcon } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { syncRfpFolder } from '@/lib/functions'
import { ACCEPT_ATTR, checkRfpFile, uploadRfpFiles } from '@/lib/rfp-files'
import { supabase } from '@/lib/supabase'

const titleFromFileName = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim() || 'New RFP'
const SCANNED_NOTE = 'Scanned document: double-check dates and figures.'
const formatSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`)

export function NewRfpDialog() {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [scanned, setScanned] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const reset = () => {
    setFile(null)
    setScanned(false)
    setFileError(null)
    setChecking(false)
  }

  const create = useMutation({
    mutationFn: async (chosen: File) => {
      // The title is provisional; it is replaced with the real one read from the RFP.
      const { data, error } = await supabase
        .from('rfps')
        .insert({ title: titleFromFileName(chosen.name), extract_status: 'pending', upload_note: scanned ? SCANNED_NOTE : null })
        .select('id')
        .single()
      if (error) throw error

      // The RFP exists even if an upload or the Drive step fails; its page shows the state and lets them retry.
      await uploadRfpFiles(data.id, [chosen]).catch(() => undefined)
      await syncRfpFolder(data.id).catch(() => undefined)
      return data.id
    },
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: ['rfps'] })
      setOpen(false)
      reset()
      navigate(`/rfps/${id}`)
    },
  })

  // Checks the file as soon as it is chosen, so a problem shows before anything is uploaded.
  const choose = async (picked: File | undefined) => {
    reset()
    if (!picked) return
    setChecking(true)
    const result = await checkRfpFile(picked)
    setChecking(false)
    if (!result.ok) return setFileError(result.reason)
    setScanned(result.scanned)
    setFile(picked)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    void choose(e.dataTransfer.files[0])
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger render={<Button />}>New RFP</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New RFP</DialogTitle>
          <DialogDescription>
            The client, title and dates are read from the RFP, its Drive folder is set up, and the fit review starts on its own.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm ${dragging ? 'border-foreground bg-muted' : ''}`}
          >
            {checking ? (
              <LoaderCircleIcon className="size-5 animate-spin text-muted-foreground" aria-hidden />
            ) : file ? (
              <FileTextIcon className="size-5 text-muted-foreground" aria-hidden />
            ) : (
              <UploadIcon className="size-5 text-muted-foreground" aria-hidden />
            )}
            {file ? (
              <p>
                <span className="font-medium">{file.name}</span> <span className="text-muted-foreground">· {formatSize(file.size)}</span>
              </p>
            ) : (
              <p className="text-muted-foreground">{checking ? 'Checking the file…' : 'Drop the RFP here'}</p>
            )}
            <input
              ref={input}
              id="file"
              type="file"
              accept={ACCEPT_ATTR}
              className="sr-only"
              onChange={(e) => void choose(e.target.files?.[0])}
            />
            <Button type="button" variant="outline" size="sm" disabled={create.isPending} onClick={() => input.current?.click()}>
              {file ? 'Choose a different file' : 'Choose a file'}
            </Button>
            <p className="text-xs text-muted-foreground">PDF or Word (.docx), up to 50 MB.</p>
          </div>
          {fileError && (
            <p role="alert" className="text-sm text-destructive">
              {fileError}
            </p>
          )}
          {scanned && !fileError && <p className="text-sm text-amber-700 dark:text-amber-400">{SCANNED_NOTE}</p>}
          {create.error && <p className="text-sm text-destructive">Could not save. Please try again.</p>}
        </div>
        <DialogFooter>
          <Button disabled={!file || checking || create.isPending} onClick={() => file && create.mutate(file)}>
            {create.isPending ? 'Uploading…' : 'Add RFP'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
