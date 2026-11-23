import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/** The rubric in the code is the one that counts. If it differs from the active version, it is saved as the next one. */
export async function rubricFor(supabase: SupabaseClient, content: string): Promise<{ id: string; content: string } | null> {
  const { data } = await supabase.from("rubrics").select("id, content").eq("is_active", true).maybeSingle();
  if (data && data.content === content) return data;
  const { data: id, error } = await supabase.rpc("save_rubric_version", { p_content: content });
  return error || !id ? null : { id: id as string, content };
}
