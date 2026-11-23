import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

/** Calls an Edge Function and throws an Error carrying the function's own message. */
export async function invokeFunction(name: string, body: Record<string, unknown>) {
  const { error } = await supabase.functions.invoke(name, { body })
  if (error) {
    const detail = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null
    throw new Error(detail?.error ?? 'Something went wrong. Please try again.')
  }
}

/** `refresh` is for a replaced file: read the details again without touching the title or client. */
export const syncRfpFolder = (rfpId: string, options: { refresh?: boolean } = {}) =>
  invokeFunction('sync-rfp-folder', { rfp_id: rfpId, ...options })

/** The questions doc: build it, retry its suggestions, or mark it sent (`sentOn` is a YYYY-MM-DD day). */
export const questionsDoc = (rfpId: string, action: 'build' | 'suggest' | 'send', options: { sentOn?: string } = {}) =>
  invokeFunction('questions-doc', { rfp_id: rfpId, action, sent_on: options.sentOn })

/** Reads one batch of answers: matches them to the questions, re-scores, and picks up changed dates. */
export const readAnswers = (answersId: string) => invokeFunction('read-answers', { answers_id: answersId })

/** Like `invokeFunction`, for a function that answers with data. */
async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    const detail = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null
    throw new Error(detail?.error ?? 'Something went wrong. Please try again.')
  }
  return data as T
}

export type ImportRowPlan = {
  row: number
  client: string
  title: string
  year: number | null
  outcome: string
  stage: string | null
  action: 'create' | 'update' | 'skip_reviewed'
  issues: { field: string; value: string; reason: string }[]
}

export type ImportPreview = {
  summary: {
    rows: number
    actions: Record<string, number>
    outcomes: Record<string, number>
    rowsWithIssues: number
    unmapped: { what: string; rows: number }[]
  }
  rows: ImportRowPlan[]
}

export type ImportResult = {
  batchId: string
  created: number
  updated: number
  skipped: number
  failed: { row: number; error: string }[]
  missingTagValues: string[]
}

/** The tracker import. `preview` writes nothing. Rows are the sheet's own row numbers (the header is row 1). */
export const previewTrackerImport = (range: { from?: number; to?: number }) => callFunction<ImportPreview>('import-tracker', { mode: 'preview', ...range })
export const runTrackerImport = (range: { from?: number; to?: number }) => callFunction<ImportResult>('import-tracker', { mode: 'import', ...range })

export type LinkRow = { row: number; client: string; status: 'linked' | 'no_access' | 'not_a_doc' | 'no_link'; docName: string | null; hasPdf: boolean; byHand: boolean }

export type LinkReport = {
  summary: { rows: number; linked: number; no_access: number; not_a_doc: number; no_link: number; withPdf: number; leftAlone: number }
  rows: LinkRow[]
  /** Only after linking. */
  written?: number
  failed?: { row: number; error: string }[]
}

/** Checks each imported RFP's proposal link. `preview` writes nothing. */
export const previewProposalLinks = (range: { from?: number; to?: number }) => callFunction<LinkReport>('link-proposals', { mode: 'preview', ...range })
export const runProposalLinks = (range: { from?: number; to?: number }) => callFunction<LinkReport>('link-proposals', { mode: 'link', ...range })

export type TagCount = { inRange: number; noDoc: number; reviewed: number; alreadyTagged: number; eligible: number; perRun: number }

export type TagRunRow = { row: number; client: string; status: 'tagged' | 'failed'; added?: Record<string, string[]>; suggested?: string[]; error?: string }

export type TagRun = Omit<TagCount, 'perRun' | 'eligible'> & { processed: number; tagged: number; failed: number; remaining: number; results: TagRunRow[] }

/** How many proposal Docs an AI tagging run would read. Uses no AI. */
export const countAiTagging = (range: { from?: number; to?: number }) => callFunction<TagCount>('tag-past-rfps', { mode: 'count', ...range })
/** Reads the next few proposal Docs and adds unconfirmed tags. Uses AI credit. */
export const runAiTagging = (range: { from?: number; to?: number }) => callFunction<TagRun>('tag-past-rfps', { mode: 'tag', ...range })

/** Reads what the RFP asks the proposal to contain, including addenda and the issuer's answers. */
export const buildRequirements = (rfpId: string) => invokeFunction('requirements', { rfp_id: rfpId })

/** Builds the proposal Doc as a copy of a past proposal, matched to what the RFP asks for. Waits for the requirements itself. */
export const proposalDoc = (rfpId: string, baseRfpId: string) => invokeFunction('proposal-doc', { rfp_id: rfpId, base_rfp_id: baseRfpId })
