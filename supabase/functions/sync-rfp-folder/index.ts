import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { extractRfpDetails } from "./extract.ts";
import { calendarDate, type Moment } from "./rfp-dates.ts";
import { createFolder, listChildren, uploadFile } from "./google.ts";

// Provided by the Supabase Edge runtime; keeps a task alive after the response is sent.
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

// Prospective Clients, inside the Business Development shared drive.
const ROOT_FOLDER_ID = Deno.env.get("DRIVE_ROOT_FOLDER_ID") ?? "0B22CMSUAolRUcVJlWjctM2xZX1U";
const SUBFOLDERS = ["RFP", "Questions", "Research", "Proposal"];
const SYNC_STALE_MS = 5 * 60 * 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Rfp = {
  id: string;
  title: string;
  client_name: string | null;
  drive_folder_id: string | null;
  drive_rfp_subfolder_id: string | null;
  extract_status: string;
};

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
};

/** The four columns that hold one date: the instant, whether a time was given, the zone, and the RFP's wording. */
function momentColumns(prefix: string, moment: Moment | null) {
  return {
    [`${prefix}_at`]: moment?.at ?? null,
    [`${prefix}_has_time`]: moment?.hasTime ?? false,
    [`${prefix}_tz`]: moment?.tz ?? null,
    [`${prefix}_text`]: moment?.text || null,
  };
}

/** Best-effort: a failure here never blocks the folder; the team can fix the details by hand. */
async function extractDetails(supabase: SupabaseClient, rfp: Rfp) {
  try {
    const { data: staged } = await supabase
      .from("rfp_documents")
      .select("file_name, storage_path")
      .eq("rfp_id", rfp.id)
      .is("drive_file_id", null);

    const files = [];
    for (const doc of staged ?? []) {
      const { data: blob } = await supabase.storage.from("rfp-documents").download(doc.storage_path);
      if (blob) files.push({ name: doc.file_name, bytes: await blob.arrayBuffer() });
    }

    const details = await extractRfpDetails(files);
    const { proposal, questionsPolicy, questions, vendorSelection } = details.dates;
    const patch: Record<string, unknown> = {
      extract_status: "done",
      extract_error: null,
      questions_policy: questionsPolicy,
      ...momentColumns("proposal_due", proposal),
      ...momentColumns("questions_due", questions),
      ...momentColumns("vendor_selection", vendorSelection),
    };

    if (details.title.trim()) patch.title = details.title.trim();
    if (details.issuing_organization.trim() && !rfp.client_name) patch.client_name = details.issuing_organization.trim();
    // The older columns the page still reads until the pills replace them.
    if (proposal) {
      patch.due_date = calendarDate(proposal);
      patch.due_date_source = "inferred";
      patch.due_date_evidence = proposal.text || null;
    }

    // Never ignore a failed save: the details would be lost and the RFP left looking unread.
    const { error: saveError } = await supabase.from("rfps").update(patch).eq("id", rfp.id);
    if (saveError) throw new Error("The details were read but could not be saved.");
    // The folder name is built from these.
    rfp.title = (patch.title as string | undefined) ?? rfp.title;
    rfp.client_name = (patch.client_name as string | undefined) ?? rfp.client_name;
  } catch (err) {
    console.error("extraction failed", err);
    const message = err instanceof Error ? err.message : "The details could not be read.";
    await supabase.from("rfps").update({ extract_status: "failed", extract_error: message }).eq("id", rfp.id);
  }
}

async function sync(supabase: SupabaseClient, rfp: Rfp) {
  const setStatus = (patch: Record<string, unknown>) => supabase.from("rfps").update(patch).eq("id", rfp.id);

  try {
    // A new upload starts with a provisional title. Read the real details first so the folder is named properly.
    if (rfp.extract_status === "pending") await extractDetails(supabase, rfp);

    let folderId = rfp.drive_folder_id;
    let rfpSubfolderId = rfp.drive_rfp_subfolder_id;

    if (!folderId || !rfpSubfolderId) {
      const name = rfp.client_name ? `${rfp.client_name} – ${rfp.title}` : rfp.title;
      const folder = await createFolder(name, ROOT_FOLDER_ID);
      folderId = folder.id;
      for (const sub of SUBFOLDERS) {
        const created = await createFolder(sub, folder.id);
        if (sub === "RFP") rfpSubfolderId = created.id;
      }
      // Save immediately so a retry never creates a second folder.
      await setStatus({
        drive_folder_id: folderId,
        drive_rfp_subfolder_id: rfpSubfolderId,
        drive_folder_url: `https://drive.google.com/drive/folders/${folderId}`,
      });
    }

    const { data: staged, error } = await supabase
      .from("rfp_documents")
      .select("id, file_name, storage_path, mime_type")
      .eq("rfp_id", rfp.id)
      .is("drive_file_id", null);
    if (error) throw new Error("Could not read the staged documents.");

    // Records that a document now lives in Drive. Never ignore a failure here: the next step deletes the staging copy.
    const markInDrive = async (docId: string, fileId: string) => {
      const { data, error: updateError } = await supabase
        .from("rfp_documents")
        .update({ drive_file_id: fileId, storage_path: `drive:${fileId}` })
        .eq("id", docId)
        .select("id");
      if (updateError || !data?.length) throw new Error("Could not record the file's Drive location.");
    };

    for (const doc of staged ?? []) {
      const { data: blob } = await supabase.storage.from("rfp-documents").download(doc.storage_path);

      if (!blob) {
        // An earlier run may have copied the file to Drive without finishing its bookkeeping. Adopt that copy.
        const existing = (await listChildren(rfpSubfolderId!)).find((f) => f.name === doc.file_name);
        if (!existing) throw new Error(`Could not read ${doc.file_name} from staging.`);
        await markInDrive(doc.id, existing.id);
        continue;
      }

      const extension = doc.file_name.split(".").pop()?.toLowerCase() ?? "";
      const mimeType = doc.mime_type ?? MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
      const fileId = await uploadFile(doc.file_name, rfpSubfolderId!, mimeType, await blob.arrayBuffer());

      await markInDrive(doc.id, fileId);
      await supabase.storage.from("rfp-documents").remove([doc.storage_path]);
    }

    await setStatus({ drive_status: "ready", drive_error: null });
  } catch (err) {
    console.error("sync failed", err);
    await setStatus({ drive_status: "failed", drive_error: err instanceof Error ? err.message : "The Drive sync failed." });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (!Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")) return json({ error: "GOOGLE_SERVICE_ACCOUNT_JSON is not set for this project." }, 500);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization" }, 401);

  // Runs as the signed-in user, so row-level security applies to the database and staging files.
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (userError || !userData.user) return json({ error: "Not signed in" }, 401);

  const { rfp_id } = await req.json().catch(() => ({}));
  if (typeof rfp_id !== "string") return json({ error: "rfp_id is required" }, 400);

  const { data: rfp, error } = await supabase
    .from("rfps")
    .select("id, title, client_name, drive_folder_id, drive_rfp_subfolder_id, extract_status, drive_status, updated_at")
    .eq("id", rfp_id)
    .single();
  if (error || !rfp) return json({ error: "RFP not found" }, 404);

  // Don't run two syncs at once for the same RFP.
  if (rfp.drive_status === "syncing" && Date.now() - new Date(rfp.updated_at).getTime() < SYNC_STALE_MS) {
    return json({ status: "syncing" }, 202);
  }

  await supabase.from("rfps").update({ drive_status: "syncing", drive_error: null }).eq("id", rfp_id);

  // Respond now; the sync keeps running in the background and the page polls the RFP.
  EdgeRuntime.waitUntil(sync(supabase, rfp));
  return json({ status: "syncing" }, 202);
});
