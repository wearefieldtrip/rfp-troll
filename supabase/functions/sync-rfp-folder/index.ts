import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { extractRfpDetails } from "./extract.ts";
import { estimateBudget } from "./nonprofit-estimate.ts";
import { calendarDate, type Moment } from "./rfp-dates.ts";
import { findClientFolder } from "./client-folder.ts";
import { createFolder, listChildren, trashFile, uploadFile } from "./google.ts";

// Provided by the Supabase Edge runtime; keeps a task alive after the response is sent.
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

// Prospective Clients, inside the Business Development shared drive.
const ROOT_FOLDER_ID = Deno.env.get("DRIVE_ROOT_FOLDER_ID") ?? "0B22CMSUAolRUcVJlWjctM2xZX1U";
const SYNC_STALE_MS = 5 * 60 * 1000;
const NEW_RFP_MS = 6 * 60 * 60 * 1000;

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
  created_at: string;
  due_date_source: string | null;
  budget_source: string | null;
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

/**
 * Best-effort: a failure here never blocks the folder; the team can fix the details by hand.
 * When the file was replaced (refresh), the title and client stay as they are, and a date or budget the team typed is kept.
 */
async function extractDetails(supabase: SupabaseClient, rfp: Rfp, refresh: boolean) {
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
    const { budget } = details;
    // Only when the RFP states no budget: a rough size-based estimate from the issuer's Form 990. Never blocks the rest.
    const estimate = budget || (refresh && rfp.budget_source === "manual") ? null : await estimateBudget({ ...details.issuer, name: details.issuer.name || rfp.client_name || "" });
    const keepBudget = refresh && rfp.budget_source === "manual";
    const keepProposal = refresh && rfp.due_date_source === "manual";
    const patch: Record<string, unknown> = {
      extract_status: "done",
      extract_error: null,
      questions_policy: questionsPolicy,
      ...(keepProposal ? {} : momentColumns("proposal_due", proposal)),
      ...momentColumns("questions_due", questions),
      ...momentColumns("vendor_selection", vendorSelection),
      ...(keepBudget
        ? {}
        : {
            budget_min_usd: budget?.min ?? null,
            budget_max_usd: budget?.max ?? null,
            budget_qualifier: budget?.qualifier || null,
            budget_wording: budget?.wording || null,
            budget_source: budget ? "inferred" : null,
            budget_estimate: estimate,
          }),
    };

    if (!refresh) {
      if (details.title.trim()) patch.title = details.title.trim();
      if (details.issuing_organization.trim() && !rfp.client_name) patch.client_name = details.issuing_organization.trim();
    }
    // The older columns the page still reads until the pills replace them.
    if (proposal && !keepProposal) {
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

/** The first fit review starts on its own once the file is safe in Drive. Best-effort: the profile has a Run button if this doesn't happen. */
async function startFirstReview(supabase: SupabaseClient, rfp: Rfp, authHeader: string) {
  try {
    const { data: existing } = await supabase.from("rfp_reviews").select("id").eq("rfp_id", rfp.id).limit(1);
    if (existing?.length) return;
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/review-rfp`, {
      method: "POST",
      headers: { Authorization: authHeader, apikey: Deno.env.get("SUPABASE_ANON_KEY")!, "Content-Type": "application/json" },
      body: JSON.stringify({ rfp_id: rfp.id }),
    });
    if (!res.ok) console.error("first review did not start", res.status, await res.text().catch(() => ""));
  } catch (err) {
    console.error("first review did not start", err);
  }
}

async function sync(supabase: SupabaseClient, rfp: Rfp, authHeader: string, refresh: boolean) {
  // A retry soon after upload still counts as the first run; an old RFP never starts a review by itself.
  const firstUpload = !refresh && (rfp.extract_status === "pending" || Date.now() - new Date(rfp.created_at).getTime() < NEW_RFP_MS);
  const setStatus = (patch: Record<string, unknown>) => supabase.from("rfps").update(patch).eq("id", rfp.id);

  try {
    // A new upload starts with a provisional title. Read the real details first so the folder is named properly.
    if (rfp.extract_status === "pending" || refresh) await extractDetails(supabase, rfp, refresh);

    let folderId = rfp.drive_folder_id;
    // RFPs made before client folders were shared keep their own RFP subfolder; new ones go straight into the client folder.
    const targetId = () => rfp.drive_rfp_subfolder_id ?? folderId!;

    if (!folderId) {
      // One folder per client, named with the client name only. Reuse it if the client already has one.
      const name = rfp.client_name || rfp.title;
      const existing = rfp.client_name ? findClientFolder(await listChildren(ROOT_FOLDER_ID), rfp.client_name) : null;
      folderId = existing?.id ?? (await createFolder(name, ROOT_FOLDER_ID)).id;
      // Save immediately so a retry never creates a second folder.
      await setStatus({ drive_folder_id: folderId, drive_folder_url: `https://drive.google.com/drive/folders/${folderId}` });
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
        const existing = (await listChildren(targetId())).find((f) => f.name === doc.file_name);
        if (!existing) throw new Error(`Could not read ${doc.file_name} from staging.`);
        await markInDrive(doc.id, existing.id);
        continue;
      }

      const extension = doc.file_name.split(".").pop()?.toLowerCase() ?? "";
      const mimeType = doc.mime_type ?? MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
      const fileId = await uploadFile(doc.file_name, targetId(), mimeType, await blob.arrayBuffer());

      await markInDrive(doc.id, fileId);
      await supabase.storage.from("rfp-documents").remove([doc.storage_path]);
    }

    // A replaced file: once the new one is in Drive, the old one goes to the Drive trash and out of the app.
    // Never when nothing else is left, so a half-finished replacement can't empty the RFP.
    const { data: all } = await supabase.from("rfp_documents").select("id, drive_file_id, superseded_at").eq("rfp_id", rfp.id);
    if (all?.some((d) => !d.superseded_at && d.drive_file_id)) {
      for (const doc of all.filter((d) => d.superseded_at)) {
        if (doc.drive_file_id) await trashFile(doc.drive_file_id);
        const { error: removeError } = await supabase.from("rfp_documents").delete().eq("id", doc.id);
        if (removeError) throw new Error("Could not remove the replaced file.");
      }
    }

    await setStatus({ drive_status: "ready", drive_error: null });
    if (firstUpload) await startFirstReview(supabase, rfp, authHeader);
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

  const { rfp_id, refresh } = await req.json().catch(() => ({}));
  if (typeof rfp_id !== "string") return json({ error: "rfp_id is required" }, 400);

  const { data: rfp, error } = await supabase
    .from("rfps")
    .select("id, title, client_name, drive_folder_id, drive_rfp_subfolder_id, extract_status, created_at, due_date_source, budget_source, drive_status, updated_at")
    .eq("id", rfp_id)
    .single();
  if (error || !rfp) return json({ error: "RFP not found" }, 404);

  // Don't run two syncs at once for the same RFP.
  if (rfp.drive_status === "syncing" && Date.now() - new Date(rfp.updated_at).getTime() < SYNC_STALE_MS) {
    return json({ status: "syncing" }, 202);
  }

  await supabase.from("rfps").update({ drive_status: "syncing", drive_error: null }).eq("id", rfp_id);

  // Respond now; the sync keeps running in the background and the page polls the RFP.
  EdgeRuntime.waitUntil(sync(supabase, rfp, authHeader, refresh === true));
  return json({ status: "syncing" }, 202);
});
