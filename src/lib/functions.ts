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

export const syncRfpFolder = (rfpId: string) => invokeFunction('sync-rfp-folder', { rfp_id: rfpId })
