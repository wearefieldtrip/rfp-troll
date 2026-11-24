import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/**
 * The active rubric in the database is the one that counts. It is published from the Google Doc by a person (the Rubric
 * button in the app). Only when there is none yet is the checked-in copy (docs/fit-rubric.md) saved as the first version.
 */
export async function rubricFor(supabase: SupabaseClient, fallback: string): Promise<{ id: string; content: string } | null> {
  const { data } = await supabase.from("rubrics").select("id, content").eq("is_active", true).maybeSingle();
  if (data?.content) return data;
  const { data: id, error } = await supabase.rpc("save_rubric_version", { p_content: fallback });
  return error || !id ? null : { id: id as string, content: fallback };
}
