// The four background jobs behind a new RFP, as shown in the progress strip.

export type JobState = 'done' | 'active' | 'waiting' | 'failed'
export type ReviewState = 'none' | 'running' | 'complete' | 'failed'

export type Job = { key: 'saved' | 'names' | 'folder' | 'review'; label: string; state: JobState }

export function jobStates(rfp: { extract_status: string; drive_status: string }, review: ReviewState): Job[] {
  const syncing = rfp.drive_status === 'syncing'
  const driveFailed = rfp.drive_status === 'failed'
  const readingNames = rfp.extract_status === 'pending'

  const names: JobState =
    rfp.extract_status === 'done' ? 'done' : rfp.extract_status === 'failed' || (readingNames && driveFailed) ? 'failed' : syncing ? 'active' : 'waiting'
  const folder: JobState = rfp.drive_status === 'ready' ? 'done' : driveFailed ? 'failed' : syncing && !readingNames ? 'active' : 'waiting'
  const reviewJob: JobState =
    review === 'complete' ? 'done' : review === 'failed' ? 'failed' : review === 'running' ? 'active' : 'waiting'

  return [
    { key: 'saved', label: 'RFP saved', state: 'done' },
    { key: 'names', label: 'Client and RFP name', state: names },
    { key: 'folder', label: 'Drive folder', state: folder },
    { key: 'review', label: 'Dates and fit review', state: reviewJob },
  ]
}

/** The strip stays up until every job is done, so a failure is never hidden. */
export const allDone = (jobs: Job[]) => jobs.every((j) => j.state === 'done')
