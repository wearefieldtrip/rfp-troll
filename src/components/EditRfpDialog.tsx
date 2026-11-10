import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { manualDayColumns } from '@/lib/moment-columns'
import { formatBudget, parseBudgetInput } from '@/lib/rfp-budget'
import { supabase } from '@/lib/supabase'

type Props = {
  rfp: {
    id: string
    title: string
    client_name: string | null
    due_date: string | null
    budget_min_usd: number | null
    budget_max_usd: number | null
    budget_qualifier: string | null
  }
}

class BudgetTypo extends Error {}

export function EditRfpDialog({ rfp }: Props) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const [budgetError, setBudgetError] = useState(false)

  const save = useMutation({
    mutationFn: async (form: FormData) => {
      const text = (key: string) => ((form.get(key) as string) ?? '').trim() || null
      const dueDate = text('due_date')

      // A budget someone typed is confirmed, not read from the RFP. Only touch it if they changed it.
      const typedBudget = parseBudgetInput((form.get('budget') as string) ?? '')
      if (!typedBudget.ok) throw new BudgetTypo()
      const qualifier = text('budget_qualifier')
      const budgetChanged =
        typedBudget.min !== rfp.budget_min_usd || typedBudget.max !== rfp.budget_max_usd || qualifier !== (rfp.budget_qualifier || null)
      const hasBudget = typedBudget.min !== null || typedBudget.max !== null

      const { error } = await supabase
        .from('rfps')
        .update({
          title: text('title') ?? rfp.title,
          client_name: text('client_name'),
          due_date: dueDate,
          // A date someone typed is confirmed, not inferred.
          ...(dueDate !== rfp.due_date ? { due_date_source: dueDate ? 'manual' : null, due_date_evidence: null, ...manualDayColumns('proposal_due', dueDate) } : {}),
          ...(budgetChanged
            ? {
                budget_min_usd: typedBudget.min,
                budget_max_usd: typedBudget.max,
                budget_qualifier: hasBudget ? qualifier : null,
                budget_wording: null,
                budget_source: hasBudget ? 'manual' : null,
              }
            : {}),
        })
        .eq('id', rfp.id)
      if (error) throw error
    },
    onError: (err) => setBudgetError(err instanceof BudgetTypo),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['rfps'] })
      setBudgetError(false)
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
          <div className="space-y-2">
            <Label htmlFor="edit-budget">Budget</Label>
            <Input
              id="edit-budget"
              name="budget"
              placeholder="$95K–$125K, up to 100k, 50k+, or a single amount"
              defaultValue={formatBudget(rfp.budget_min_usd, rfp.budget_max_usd)}
              aria-invalid={budgetError}
            />
            <Input name="budget_qualifier" placeholder="Note, such as all-inclusive or plus media" defaultValue={rfp.budget_qualifier ?? ''} />
            <p className="text-xs text-muted-foreground">Leave the budget blank if the RFP doesn't state one.</p>
          </div>
          {budgetError && <p className="text-sm text-destructive">That budget isn't an amount I understand. Try $95K, $95K–$125K or up to 100k.</p>}
          {save.error && !budgetError && <p className="text-sm text-destructive">Could not save. Please try again.</p>}
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
