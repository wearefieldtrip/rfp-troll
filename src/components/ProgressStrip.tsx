import { CheckIcon, CircleIcon, LoaderCircleIcon, TriangleAlertIcon } from 'lucide-react'
import { allDone, type Job, type JobState } from '@/lib/progress'

const ICON: Record<JobState, typeof CheckIcon> = { done: CheckIcon, active: LoaderCircleIcon, waiting: CircleIcon, failed: TriangleAlertIcon }
const TONE: Record<JobState, string> = {
  done: 'text-emerald-700 dark:text-emerald-400',
  active: 'text-foreground',
  waiting: 'text-muted-foreground',
  failed: 'text-destructive',
}

type Props = {
  jobs: Job[]
  retrying: boolean
  onRetry: (key: Job['key']) => void
}

/** Shows each background job for a new RFP until all four are done. A failed job offers its own retry. */
export function ProgressStrip({ jobs, retrying, onRetry }: Props) {
  if (allDone(jobs)) return null
  const stillWorking = jobs.some((j) => j.state === 'active' || j.state === 'waiting')

  return (
    <div className="rounded-lg border p-4" role="status" aria-live="polite">
      <ol className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {jobs.map((job) => {
          const Icon = ICON[job.state]
          return (
            <li key={job.key} className={`flex items-center gap-2 ${TONE[job.state]}`}>
              <Icon className={`size-4 ${job.state === 'active' ? 'animate-spin' : ''}`} aria-hidden />
              <span>{job.label}</span>
              {job.state === 'failed' && (job.key === 'names' || job.key === 'folder') && (
                <button type="button" disabled={retrying} onClick={() => onRetry(job.key)} className="underline underline-offset-4 disabled:opacity-60">
                  Retry
                </button>
              )}
              {job.state === 'failed' && job.key === 'review' && <span className="text-muted-foreground">· run it again below</span>}
            </li>
          )
        })}
      </ol>
      {stillWorking && <p className="mt-2 text-xs text-muted-foreground">Usually 2–3 minutes. You can leave this page.</p>}
    </div>
  )
}
