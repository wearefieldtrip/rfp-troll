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
