import { ChevronDownIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  number: number
  title: string
  /** What the step came to, shown on one line while it is collapsed. */
  summary?: ReactNode
  open: boolean
  onToggle: () => void
  children: ReactNode
}

/** One step of the process. The current step is open; finished steps fold up to a line you can open again. */
export function StepSection({ number, title, summary, open, onToggle, children }: Props) {
  return (
    <section className="space-y-6" aria-label={`${number} · ${title}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 border-b pb-4 text-left"
      >
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
            open ? 'bg-foreground text-background' : 'border text-muted-foreground',
          )}
          aria-hidden
        >
          {number}
        </span>
        <span className={cn('font-semibold tracking-tight', open ? 'text-2xl' : 'text-base text-muted-foreground')}>{title}</span>
        {!open && summary && <span className="min-w-0 flex-1 text-sm text-muted-foreground">{summary}</span>}
        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          {open ? 'Hide' : 'Show'}
          <ChevronDownIcon className={cn('size-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
        </span>
      </button>
      {open && <div className="space-y-8">{children}</div>}
    </section>
  )
}
