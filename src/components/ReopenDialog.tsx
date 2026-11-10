import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { invokeFunction } from '@/lib/functions'

type Props = { rfpId: string; passed: boolean; open: boolean; onOpenChange: (open: boolean) => void }

export function ReopenDialog({ rfpId, passed, open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const reopen = useMutation({
    mutationFn: () => invokeFunction('pass-rfp', { rfp_id: rfpId, action: 'reopen' }),
    onSuccess: async () => {
      onOpenChange(false)
      await queryClient.invalidateQueries({ queryKey: ['rfps'] })
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (reopen.isPending) return
        onOpenChange(next)
        if (!next) reopen.reset()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reopen this RFP?</DialogTitle>
          <DialogDescription>
            {passed
              ? 'It goes back to the step it was passed from, and its Drive folder returns to Prospective Clients if it was moved.'
              : 'It goes back to Submitted · Waiting.'}{' '}
            The reopening is added to the decision record.
          </DialogDescription>
        </DialogHeader>
        {reopen.error && <p className="text-sm text-destructive">{reopen.error.message}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={reopen.isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={reopen.isPending} onClick={() => reopen.mutate()}>
            {reopen.isPending ? 'Reopening…' : 'Reopen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
