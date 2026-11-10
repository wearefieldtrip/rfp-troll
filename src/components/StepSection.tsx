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
    <section className="space-y-4" aria-label={`${number} · ${title}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 border-b pb-2 text-left"
      >
        <span className="text-sm font-semibold">
          {number} · {title}
        </span>
        {!open && summary && <span className="min-w-0 flex-1 text-sm text-muted-foreground">{summary}</span>}
        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          {open ? 'Hide' : 'Show'}
          <ChevronDownIcon className={cn('size-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
        </span>
      </button>
      {open && <div className="space-y-6">{children}</div>}
    </section>
  )
}
