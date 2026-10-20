import { ClockIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { daysUntil, formatLongDate } from '@/lib/key-dates'

type Urgency = 'calm' | 'soon' | 'close' | 'urgent'

const urgencyFor = (days: number): Urgency => (days <= 3 ? 'urgent' : days <= 7 ? 'close' : days <= 14 ? 'soon' : 'calm')

const STYLES: Record<Urgency, string> = {
  calm: 'border-border bg-muted/50 text-foreground',
  soon: 'border-yellow-300 bg-yellow-100 text-yellow-950 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-100',
  close: 'border-orange-300 bg-orange-100 text-orange-950 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-100',
  urgent: 'border-red-300 bg-red-100 text-red-950 dark:border-red-800 dark:bg-red-950 dark:text-red-100',
}

/** A slim banner counting down to the proposal due date. */
export function DueCountdown({ dueDate, inferred }: { dueDate: string; inferred: boolean }) {
  const days = daysUntil(dueDate)
  const count = Math.abs(days)
  const unit = count === 1 ? 'day' : 'days'

  const message =
    days === 0 ? 'Proposals are due today' : days < 0 ? `${count} ${unit} past the proposal due date` : `${count} ${unit} until proposals are due`

  return (
    <div
      role="status"
      className={cn('flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border px-4 py-2 text-sm', STYLES[days < 0 ? 'urgent' : urgencyFor(days)])}
    >
      <ClockIcon className="size-4 shrink-0" aria-hidden />
      <span className="font-semibold">{message}</span>
      <span className="opacity-80">
        · {formatLongDate(dueDate)}
        {inferred && ' (from the RFP)'}
      </span>
    </div>
  )
}
