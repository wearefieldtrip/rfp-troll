import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { readAnswers } from '@/lib/functions'
import { todayInputValue } from '@/lib/questions-view'
import { ACCEPT_ATTR, checkRfpFile } from '@/lib/rfp-files'
import { supabase } from '@/lib/supabase'

type Props = { rfpId: string; open: boolean; onOpenChange: (open: boolean) => void; more?: boolean }

const BUCKET = 'rfp-documents'

export function AddAnswersDialog({ rfpId, open, onOpenChange, more = false }: Props) {
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [pasted, setPasted] = useState('')
  const [receivedOn, setReceivedOn] = useState(todayInputValue)
  const [problem, setProblem] = useState<string | null>(null)

  const reset = () => {
    setFile(null)
    setPasted('')
    setReceivedOn(todayInputValue())
    setProblem(null)
  }

  const add = useMutation({
    mutationFn: async () => {
      let storagePath: string | null = null
      if (file) {
        const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_')
        storagePath = `${rfpId}/answers/${crypto.randomUUID()}-${safeName}`
        const { error } = await supabase.storage.from(BUCKET).upload(storagePath, file)
        if (error) throw error
      }
      // The record exists before anything is read, so a failure never loses the answers.
      const { data: row, error: rowError } = await supabase
        .from('rfp_answers')
        .insert({
          rfp_id: rfpId,
          received_on: receivedOn,
          file_name: file?.name ?? null,
          storage_path: storagePath,
          pasted_text: file ? null : pasted.trim(),
        })
        .select('id')
        .single()
      if (rowError || !row) {
        if (storagePath) await supabase.storage.from(BUCKET).remove([storagePath])
        throw rowError ?? new Error('Could not save the answers.')
      }
      try {
        await readAnswers(row.id)
      } catch (err) {
        // The answers are saved; the card offers a retry.
        await supabase.from('rfp_answers').update({ status: 'failed', error: err instanceof Error ? err.message : 'The reading could not start.' }).eq('id', row.id)
      }
    },
    onSuccess: async () => {
      onOpenChange(false)
      reset()
      await queryClient.invalidateQueries({ queryKey: ['rfps', rfpId] })
    },
  })

  const choose = async (picked: File | undefined) => {
    if (!picked) return
    const check = await checkRfpFile(picked)
    if (!check.ok) {
      setProblem(check.reason)
      return
    }
    setProblem(null)
    setFile(picked)
  }

  const ready = (!!file || pasted.trim().length > 0) && !!receivedOn

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (add.isPending) return
        onOpenChange(next)
        if (!next) {
          reset()
          add.reset()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{more ? 'Add more answers' : 'Add answers'}</DialogTitle>
          <DialogDescription>
            Upload the issuer's answers, or paste them. Reading them uses AI credit: it matches them to your questions, re-scores the fit and picks up changed dates.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4 text-sm">
          <div className="space-y-2">
            <Label>File</Label>
            <input ref={input} type="file" accept={ACCEPT_ATTR} className="hidden" onChange={(e) => void choose(e.target.files?.[0])} />
            <div className="flex min-w-0 items-center gap-3">
              <Button type="button" variant="outline" size="sm" disabled={add.isPending || pasted.trim().length > 0} onClick={() => input.current?.click()}>
                {file ? 'Choose a different file' : 'Choose a PDF or Word file'}
              </Button>
              {file && <span className="min-w-0 break-all">{file.name}</span>}
            </div>
            {problem && <p className="text-destructive">{problem}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pasted-answers">Or paste the answers</Label>
            <Textarea id="pasted-answers" rows={5} value={pasted} disabled={add.isPending || !!file} onChange={(e) => setPasted(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="received-on">Date received</Label>
            <Input id="received-on" type="date" value={receivedOn} max={todayInputValue()} onChange={(e) => setReceivedOn(e.target.value)} disabled={add.isPending} />
          </div>

          {add.error && <p className="text-destructive">{add.error.message}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={add.isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!ready || add.isPending} onClick={() => add.mutate()}>
            {add.isPending ? 'Saving…' : more ? 'Add more answers' : 'Add answers'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
