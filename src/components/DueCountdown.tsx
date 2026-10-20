import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { daysUntil, formatLongDate } from '@/lib/key-dates'

type Urgency = 'calm' | 'soon' | 'close' | 'urgent'

const urgencyFor = (days: number): Urgency => (days <= 3 ? 'urgent' : days <= 7 ? 'close' : days <= 14 ? 'soon' : 'calm')

const STYLES: Record<Urgency, string> = {
  calm: 'border-border bg-card',
  soon: 'border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/40',
  close: 'border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/40',
  urgent: 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40',
}

/** A large callout counting down to the proposal due date. */
export function DueCountdown({ dueDate, inferred }: { dueDate: string; inferred: boolean }) {
  const days = daysUntil(dueDate)
  const urgency = urgencyFor(days)
  const overdue = days < 0
  const count = Math.abs(days)

  const headline = days === 0 ? 'Due today' : `${count} ${count === 1 ? 'day' : 'days'}`
  const caption = days === 0 ? 'Proposals are due today' : overdue ? 'past the proposal due date' : 'until proposals are due'

  return (
    <Card className={cn(STYLES[overdue ? 'urgent' : urgency])}>
      <CardContent className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-5xl font-semibold tracking-tight">{headline}</span>
        {days !== 0 && <span className="text-lg text-muted-foreground">{caption}</span>}
        <span className="ml-auto text-sm text-muted-foreground">
          {formatLongDate(dueDate)}
          {inferred && ' · from the RFP, confirm before relying on it'}
        </span>
      </CardContent>
    </Card>
  )
}
