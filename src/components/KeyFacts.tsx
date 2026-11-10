import { ExternalLinkIcon, LoaderCircleIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { TONE_CLASSES } from '@/lib/fit-tone'
import { dayCountLabel, daysUntilMoment, urgencyFor } from '@/lib/key-dates'
import { momentFrom } from '@/lib/moment-columns'
import { formatMoment, type Moment } from '@/lib/rfp-dates'
import type { Database } from '@/lib/database.types'
import { cn } from '@/lib/utils'

type Rfp = Database['public']['Tables']['rfps']['Row']

function Chip({ label, tone, title, children }: { label: string; tone?: Urgency; title?: string; children: ReactNode }) {
  return (
    <span
      title={title}
      className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm', tone ? TONE_CLASSES[tone].badge : 'bg-muted/50')}
    >
      <b className="font-semibold">{label}</b>
      {children}
    </span>
  )
}
type Urgency = Exclude<ReturnType<typeof urgencyFor>, null>

const NotStated = () => <span className="text-muted-foreground">Not stated</span>

/** The date, then how many days away it is. A deadline you can still act on tightens in color as it nears. */
function DateChip({ label, moment, prefix = '', deadline = false, title }: { label: string; moment: Moment | null; prefix?: string; deadline?: boolean; title?: string }) {
  if (!moment) {
    return (
      <Chip label={label}>
        <NotStated />
      </Chip>
    )
  }
  const days = daysUntilMoment(moment)
  const tone = deadline ? urgencyFor(days) : null
  return (
    <Chip label={label} tone={tone ?? undefined} title={title}>
      <span>
        {prefix}
        {formatMoment(moment)}
      </span>
      <span className="opacity-70">· {dayCountLabel(days)}</span>
    </Chip>
  )
}

const quote = (text: string | null) => (text ? `From the RFP: “${text}”` : undefined)

export function KeyFacts({
  rfp,
  reading,
  onRetryDrive,
  retryingDrive,
}: {
  rfp: Rfp
  reading: boolean
  onRetryDrive: () => void
  retryingDrive: boolean
}) {
  // While the RFP is being read, show the pills' places instead of "Not stated", which would be untrue.
  if (reading) {
    return (
      <div className="flex flex-wrap gap-2" aria-hidden>
        {[240, 270, 200, 210, 130].map((w) => (
          <Skeleton key={w} className="h-[30px] rounded-full" style={{ width: w }} />
        ))}
      </div>
    )
  }

  const proposalTitle = rfp.due_date_source === 'manual' ? 'Entered by your team' : quote(rfp.proposal_due_text)
  const questions = rfp.questions_policy === 'due' ? momentFrom(rfp, 'questions_due') : null

  return (
    <div className="flex flex-wrap gap-2">
      <DateChip label="Proposal due" moment={momentFrom(rfp, 'proposal_due')} deadline title={proposalTitle} />

      {rfp.questions_policy === 'not_allowed' ? (
        <Chip label="Questions" title={quote(rfp.questions_due_text)}>
          Not allowed
        </Chip>
      ) : questions ? (
        <DateChip label="Questions" moment={questions} prefix="Due " deadline title={quote(rfp.questions_due_text)} />
      ) : (
        <Chip label="Questions">
          <NotStated />
        </Chip>
      )}

      <DateChip label="Vendor selected" moment={momentFrom(rfp, 'vendor_selection')} title={quote(rfp.vendor_selection_text)} />

      {rfp.drive_status === 'ready' && rfp.drive_folder_url ? (
        <a
          href={rfp.drive_folder_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold hover:bg-muted/50"
        >
          Drive folder
          <ExternalLinkIcon className="size-3" aria-hidden />
        </a>
      ) : rfp.drive_status === 'syncing' ? (
        <Chip label="Drive folder">
          <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
          <span className="text-muted-foreground">Creating…</span>
        </Chip>
      ) : (
        <Chip label="Drive folder" title={rfp.drive_error ?? undefined}>
          <span className="text-muted-foreground">Not created</span>
          <button type="button" disabled={retryingDrive} onClick={onRetryDrive} className="underline underline-offset-4 disabled:opacity-60">
            {rfp.drive_status === 'failed' ? 'Retry' : 'Create'}
          </button>
        </Chip>
      )}
    </div>
  )
}
