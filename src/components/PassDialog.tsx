import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PASS_REASONS, type PassReason } from '@/lib/decisions'
import { invokeFunction } from '@/lib/functions'
import { cn } from '@/lib/utils'

export function PassDialog({ rfpId, open, onOpenChange }: { rfpId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const [reasons, setReasons] = useState<PassReason[]>([])
  const [note, setNote] = useState('')

  const pass = useMutation({
    mutationFn: () => invokeFunction('pass-rfp', { rfp_id: rfpId, reasons, note: note.trim() }),
    onSuccess: async () => {
      onOpenChange(false)
      await queryClient.invalidateQueries({ queryKey: ['rfps'] })
    },
  })

  const close = (next: boolean) => {
    if (pass.isPending) return
    onOpenChange(next)
    if (!next) {
      setReasons([])
      setNote('')
      pass.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pass on this RFP?</DialogTitle>
          <DialogDescription>It moves to Closed · Passed, and its Drive folder moves to _DEAD Opportunities unless the client has another open RFP. You can reopen it later.</DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-2">
          <legend className="pb-2 text-sm font-semibold">
            Reasons <span className="font-normal text-muted-foreground">(choose all that apply)</span>
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {PASS_REASONS.map((r) => (
              <label
                key={r}
                className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-sm', reasons.includes(r) && 'border-foreground bg-muted')}
              >
                <input
                  type="checkbox"
                  className="size-4 accent-foreground"
                  checked={reasons.includes(r)}
                  onChange={(e) => setReasons((cur) => (e.target.checked ? [...cur, r] : cur.filter((x) => x !== r)))}
                />
                {r}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="pass-note">
            Note <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea id="pass-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        {pass.error && <p className="text-sm text-destructive">{pass.error.message}</p>}

        <DialogFooter>
          <Button variant="outline" disabled={pass.isPending} onClick={() => close(false)}>
            Cancel
          </Button>
          <Button disabled={reasons.length === 0 || pass.isPending} onClick={() => pass.mutate()}>
            {pass.isPending ? 'Passing…' : 'Pass'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
