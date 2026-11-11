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
