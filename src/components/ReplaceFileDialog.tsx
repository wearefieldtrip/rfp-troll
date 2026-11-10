import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { syncRfpFolder } from '@/lib/functions'
import { ACCEPT_ATTR, checkRfpFile, uploadRfpFiles } from '@/lib/rfp-files'
import { supabase } from '@/lib/supabase'

const SCANNED_NOTE = 'Scanned document: double-check dates and figures.'

type Props = { rfpId: string; open: boolean; onOpenChange: (open: boolean) => void }

/** Swaps in a new version of the RFP (an addendum or a corrected file). Title and client stay; dates and budget are read again. */
export function ReplaceFileDialog({ rfpId, open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [scanned, setScanned] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const reset = () => {
    setFile(null)
    setScanned(false)
    setProblem(null)
  }

  const replace = useMutation({
    mutationFn: async (chosen: File) => {
      // Mark the old file first, so a failure partway never leaves the app reading both. The next sync clears it out of Drive.
      const { error: markError } = await supabase.from('rfp_documents').update({ superseded_at: new Date().toISOString() }).eq('rfp_id', rfpId).is('superseded_at', null)
      if (markError) throw markError
      try {
        await uploadRfpFiles(rfpId, [chosen])
      } catch (err) {
        // The new file never arrived, so the old one stays.
        await supabase.from('rfp_documents').update({ superseded_at: null }).eq('rfp_id', rfpId)
        throw err
      }
      const { error: noteError } = await supabase.from('rfps').update({ upload_note: scanned ? SCANNED_NOTE : null }).eq('id', rfpId)
      if (noteError) throw noteError
      await syncRfpFolder(rfpId, { refresh: true })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['rfps'] })
      onOpenChange(false)
      reset()
    },
  })

  const choose = async (picked: File | undefined) => {
    reset()
    if (!picked) return
    setChecking(true)
    const result = await checkRfpFile(picked)
    setChecking(false)
    if (!result.ok) return setProblem(result.reason)
    setScanned(result.scanned)
    setFile(picked)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (replace.isPending) return
        onOpenChange(next)
        if (!next) {
          reset()
          replace.reset()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace the RFP file</DialogTitle>
          <DialogDescription>
            The old file goes to the Drive trash and the new one takes its place. The title and client stay as they are; the dates and
            budget are read again, except any you entered yourself. Nothing is scored again until you run the review.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <input ref={input} type="file" accept={ACCEPT_ATTR} className="sr-only" onChange={(e) => void choose(e.target.files?.[0])} />
          <Button type="button" variant="outline" disabled={checking || replace.isPending} onClick={() => input.current?.click()}>
            {file ? file.name : checking ? 'Checking the file…' : 'Choose a file'}
          </Button>
          <p className="text-xs text-muted-foreground">PDF or Word (.docx), up to 50 MB.</p>
          {problem && (
            <p role="alert" className="text-sm text-destructive">
              {problem}
            </p>
          )}
          {scanned && !problem && <p className="text-sm text-amber-700 dark:text-amber-400">{SCANNED_NOTE}</p>}
          {replace.error && <p className="text-sm text-destructive">Could not replace the file. Please try again.</p>}
        </div>
        <DialogFooter>
          <Button disabled={!file || checking || replace.isPending} onClick={() => file && replace.mutate(file)}>
            {replace.isPending ? 'Replacing…' : 'Replace file'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
