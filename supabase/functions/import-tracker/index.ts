import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { readTracker } from "./sheets.ts";
import { parseRow, planActions, selectRows, summarize, type ImportedTags, type ParsedRow, type PlanAction } from "./tracker-import.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type TagValueRow = { id: string; tag_group: string; value: string; status: string };

/** What an imported row stores on its RFP. */
function rfpColumns(row: ParsedRow) {
  return {
    title: row.title,
    client_name: row.client,
    status: row.status,
    outcome: row.outcome,
    furthest_stage: row.stage,
    closed_reason: row.reason,
    outcome_notes: row.note,
    submission_year: row.year,
    import_issues: row.issues,
    import_data: row.data,
  };
}

/**
 * Writes the row's tags as confirmed import tags. A group someone has set by hand is left alone, and a re-run
 * replaces only the earlier import tags. Returns the tag values that were not in the Library lists.
 */
async function saveTags(supabase: SupabaseClient, rfpId: string, tags: ImportedTags, values: TagValueRow[]): Promise<string[]> {
  const find = (group: string, value: string) => values.find((v) => v.tag_group === group && v.value.toLowerCase() === value.toLowerCase());
  const missing: string[] = [];

  // A state is added to the geography list the first time it appears.
  for (const value of tags.geography) {
    if (find("geography", value)) continue;
    const { data } = await supabase.from("tag_values").insert({ tag_group: "geography", value }).select("id, tag_group, value, status").single();
    if (data) values.push(data as TagValueRow);
  }

  const { data: existing } = await supabase.from("rfp_tags").select("id, tag_value_id, source").eq("rfp_id", rfpId);
  const groupOf = (valueId: string) => values.find((v) => v.id === valueId)?.tag_group;
  const byHand = new Set((existing ?? []).filter((e) => e.source === "person").map((e) => groupOf(e.tag_value_id)));

  const rows: { rfp_id: string; tag_value_id: string; source: string; confirmed: boolean }[] = [];
  for (const [group, names] of Object.entries(tags)) {
    if (byHand.has(group)) continue;
    for (const name of names) {
      const v = find(group, name);
      if (v && v.status === "approved") rows.push({ rfp_id: rfpId, tag_value_id: v.id, source: "import", confirmed: true });
      else missing.push(`${group}: ${name}`);
    }
  }

  const written = new Set(Object.keys(tags).filter((g) => !byHand.has(g)));
  const stale = (existing ?? []).filter((e) => e.source === "import" && written.has(groupOf(e.tag_value_id) ?? "")).map((e) => e.id);
  if (stale.length > 0) await supabase.from("rfp_tags").delete().in("id", stale);
  if (rows.length > 0) await supabase.from("rfp_tags").upsert(rows, { onConflict: "rfp_id,tag_value_id", ignoreDuplicates: true });
  return missing;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")) return json({ error: "GOOGLE_SERVICE_ACCOUNT_JSON is not set for this project." }, 500);
  const sheetId = Deno.env.get("TRACKER_SHEET_ID");
  if (!sheetId) return json({ error: "TRACKER_SHEET_ID is not set for this project. Add it as a function secret." }, 500);
  const tab = Deno.env.get("TRACKER_SHEET_TAB") ?? "RFPs";

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization" }, 401);

  // Runs as the signed-in user, so row-level security applies.
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (userError || !userData.user) return json({ error: "Not signed in" }, 401);

  const { mode, from, to } = await req.json().catch(() => ({}));
  if (mode !== "preview" && mode !== "import") return json({ error: "mode must be preview or import" }, 400);
  const bound = (n: unknown) => (typeof n === "number" && Number.isInteger(n) && n >= 2 ? n : undefined);

  let parsed: ParsedRow[];
  try {
    const rows = selectRows(await readTracker(sheetId, tab), bound(from), bound(to));
    parsed = rows.map(parseRow).filter((r): r is ParsedRow => r !== null);
  } catch (err) {
    console.error("reading the tracker failed", err);
    return json({ error: err instanceof Error ? err.message : "Could not read the tracker." }, 502);
  }

  const { data: found, error: findError } = await supabase.from("rfps").select("import_key, import_reviewed").in("import_key", parsed.map((p) => p.key));
  if (findError) return json({ error: "Could not check which rows are already imported." }, 500);
  const existing = new Map((found ?? []).map((f) => [f.import_key as string, { reviewed: f.import_reviewed as boolean }]));
  const plan = planActions(parsed, existing);

  const describe = (p: { row: ParsedRow; action: PlanAction }) => ({
    row: p.row.row,
    client: p.row.client,
    title: p.row.title,
    year: p.row.year,
    outcome: p.row.outcome,
    stage: p.row.stage,
    action: p.action,
    issues: p.row.issues,
  });

  if (mode === "preview") return json({ summary: summarize(plan), rows: plan.map(describe) });

  // Import. Each row stands alone, so one bad row never loses the others.
  const batchId = crypto.randomUUID();
  const { data: allValues } = await supabase.from("tag_values").select("id, tag_group, value, status");
  const values = (allValues ?? []) as TagValueRow[];

  const result = { batchId, created: 0, updated: 0, skipped: 0, failed: [] as { row: number; error: string }[], missingTagValues: [] as string[] };
  for (const { row, action } of plan) {
    if (action === "skip_reviewed") {
      result.skipped++;
      continue;
    }
    try {
      let rfpId: string;
      if (action === "create") {
        const { data, error } = await supabase
          .from("rfps")
          .insert({
            ...rfpColumns(row),
            source: "tracker",
            import_key: row.key,
            import_batch_id: batchId,
            extract_status: "done",
            drive_status: "ready",
            // Not the person who ran the import: nobody owns a past RFP.
            owner_id: null,
          })
          .select("id")
          .single();
        if (error || !data) throw new Error(error?.message ?? "Could not create the RFP.");
        rfpId = data.id;
        result.created++;
      } else {
        const { data, error } = await supabase.from("rfps").update(rfpColumns(row)).eq("import_key", row.key).eq("import_reviewed", false).select("id");
        if (error) throw new Error(error.message);
        if (!data?.length) {
          result.skipped++;
          continue;
        }
        rfpId = data[0].id;
        result.updated++;
      }
      result.missingTagValues.push(...(await saveTags(supabase, rfpId, row.tags, values)));
    } catch (err) {
      console.error("import row failed", row.row, err);
      result.failed.push({ row: row.row, error: err instanceof Error ? err.message : "Failed." });
    }
  }
  result.missingTagValues = [...new Set(result.missingTagValues)];
  return json(result);
});
