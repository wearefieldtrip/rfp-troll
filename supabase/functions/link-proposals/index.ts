import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { listFolder, lookupFile } from "./drive.ts";
import { classifyLink, fileIdFromUrl, isPdf, pickPdf, type DriveFile, type LinkStatus } from "./proposal-link.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Imported = { id: string; client_name: string | null; title: string; import_data: { tracker_row?: number; link_url?: string | null } | null; proposal_link_source: string | null };

type Checked = {
  rfpId: string;
  row: number;
  client: string;
  status: LinkStatus;
  docId: string | null;
  docName: string | null;
  pdfId: string | null;
  byHand: boolean;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")) return json({ error: "GOOGLE_SERVICE_ACCOUNT_JSON is not set for this project." }, 500);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization" }, 401);

  // Runs as the signed-in user, so row-level security applies.
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (userError || !userData.user) return json({ error: "Not signed in" }, 401);

  const { mode, from, to } = await req.json().catch(() => ({}));
  if (mode !== "preview" && mode !== "link") return json({ error: "mode must be preview or link" }, 400);
  const bound = (n: unknown) => (typeof n === "number" && Number.isInteger(n) && n >= 2 ? n : undefined);
  const [lo, hi] = [bound(from), bound(to)];

  const { data, error } = await supabase.from("rfps").select("id, client_name, title, import_data, proposal_link_source").eq("source", "tracker");
  if (error) return json({ error: "Could not read the imported RFPs." }, 500);
  const rfps = ((data ?? []) as Imported[])
    .filter((r) => {
      const row = r.import_data?.tracker_row ?? 0;
      return (lo === undefined || row >= lo) && (hi === undefined || row <= hi);
    })
    .sort((a, b) => (a.import_data?.tracker_row ?? 0) - (b.import_data?.tracker_row ?? 0));

  // One folder listing per folder, however many Docs sit in it.
  const folders = new Map<string, Promise<DriveFile[]>>();
  const siblings = (parent: string) => {
    if (!folders.has(parent)) folders.set(parent, listFolder(parent));
    return folders.get(parent)!;
  };

  async function check(r: Imported): Promise<Checked> {
    const url = r.import_data?.link_url ?? null;
    const base = { rfpId: r.id, row: r.import_data?.tracker_row ?? 0, client: r.client_name ?? r.title, byHand: r.proposal_link_source === "person" };
    const id = fileIdFromUrl(url);
    if (!id) return { ...base, status: "no_link", docId: null, docName: null, pdfId: null };

    try {
      const lookup = await lookupFile(id);
      const status = classifyLink(url, lookup);
      if (!lookup?.ok || !lookup.info) return { ...base, status, docId: null, docName: null, pdfId: null };
      if (status === "linked") {
        const pdfId = lookup.info.parent ? pickPdf(lookup.info.name, await siblings(lookup.info.parent)) : null;
        return { ...base, status, docId: id, docName: lookup.info.name, pdfId };
      }
      // A link straight to a PDF still tells us where the proposal is.
      return { ...base, status, docId: null, docName: lookup.info.name, pdfId: isPdf(lookup.info.mimeType) ? id : null };
    } catch (err) {
      console.error("link check failed", base.row, err);
      return { ...base, status: "no_access", docId: null, docName: null, pdfId: null };
    }
  }

  // A few at a time keeps it quick without flooding Drive.
  const checked: Checked[] = [];
  for (let i = 0; i < rfps.length; i += 5) checked.push(...(await Promise.all(rfps.slice(i, i + 5).map(check))));

  const count = (status: LinkStatus) => checked.filter((c) => c.status === status).length;
  const summary = {
    rows: checked.length,
    linked: count("linked"),
    no_access: count("no_access"),
    not_a_doc: count("not_a_doc"),
    no_link: count("no_link"),
    withPdf: checked.filter((c) => c.pdfId).length,
    leftAlone: checked.filter((c) => c.byHand).length,
  };
  const rows = checked.map((c) => ({ row: c.row, client: c.client, status: c.status, docName: c.docName, hasPdf: !!c.pdfId, byHand: c.byHand }));

  if (mode === "preview") return json({ summary, rows });

  // A link a person set by hand is never replaced.
  const failed: { row: number; error: string }[] = [];
  let written = 0;
  for (const c of checked.filter((x) => !x.byHand)) {
    const { error: updateError } = await supabase
      .from("rfps")
      .update({
        proposal_doc_id: c.docId,
        proposal_pdf_id: c.pdfId,
        proposal_doc_name: c.docName,
        proposal_link_status: c.status,
        proposal_link_checked_at: new Date().toISOString(),
        proposal_link_source: "import",
      })
      .eq("id", c.rfpId);
    if (updateError) failed.push({ row: c.row, error: updateError.message });
    else written++;
  }
  return json({ summary, rows, written, failed });
});
