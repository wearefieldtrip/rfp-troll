import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { trashFile } from "./google.ts";

const BUSY_MS = 10 * 60 * 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization" }, 401);

  // Runs as the signed-in user, so row-level security decides what can be deleted.
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (userError || !userData.user) return json({ error: "Not signed in" }, 401);

  const { rfp_id, trash_drive_folder } = await req.json().catch(() => ({}));
  if (typeof rfp_id !== "string") return json({ error: "rfp_id is required" }, 400);

  const { data: rfp, error } = await supabase
    .from("rfps")
    .select("id, drive_folder_id, drive_status, updated_at, questions_doc_id, questions_sent_pdf_id")
    .eq("id", rfp_id)
    .single();
  if (error || !rfp) return json({ error: "RFP not found" }, 404);

  // Don't delete while something is still working on this RFP.
  if (rfp.drive_status === "syncing" && Date.now() - new Date(rfp.updated_at).getTime() < BUSY_MS) {
    return json({ error: "The Drive folder is still being set up. Try again in a minute." }, 409);
  }
  const since = new Date(Date.now() - BUSY_MS).toISOString();
  const { data: running } = await supabase
    .from("rfp_reviews").select("id").eq("rfp_id", rfp_id).eq("status", "running").gte("created_at", since).limit(1);
  if (running?.length) return json({ error: "A fit review is still running. Try again when it finishes." }, 409);

  // The client's folder may hold other RFPs. Trash the whole folder only when this is the last one in it.
  let folderShared = false;
  if (rfp.drive_folder_id) {
    const { data: others } = await supabase.from("rfps").select("id").eq("drive_folder_id", rfp.drive_folder_id).neq("id", rfp_id).limit(1);
    folderShared = !!others?.length;
  }

  // Anything still staged in Storage (not yet moved to Drive) needs cleaning up afterward.
  const { data: docs } = await supabase.from("rfp_documents").select("storage_path, drive_file_id").eq("rfp_id", rfp_id);
  const { data: answers } = await supabase.from("rfp_answers").select("storage_path, drive_file_id").eq("rfp_id", rfp_id);
  const staged = [
    ...(docs ?? []).filter((d) => !d.drive_file_id).map((d) => d.storage_path),
    ...(answers ?? []).filter((a) => a.storage_path).map((a) => a.storage_path as string),
  ];

  // Drive first: if that fails, nothing has been deleted yet. It only ever goes to the Drive trash.
  const wantsTrash = trash_drive_folder === true && !!rfp.drive_folder_id;
  // In a shared folder only this RFP's own files go to the trash.
  const ownFiles = [
    ...(docs ?? []).map((d) => d.drive_file_id),
    ...(answers ?? []).map((a) => a.drive_file_id),
    rfp.questions_doc_id,
    rfp.questions_sent_pdf_id,
  ].filter((id): id is string => !!id);
  const toTrash: string[] = folderShared ? ownFiles : [rfp.drive_folder_id];
  const trashed: string[] = [];
  if (wantsTrash) {
    try {
      for (const id of toTrash) {
        await trashFile(id);
        trashed.push(id);
      }
    } catch (err) {
      console.error("drive trash failed", err);
      for (const id of trashed) await trashFile(id, false).catch((e) => console.error("restore failed", e));
      return json({ error: "Could not move the Drive folder to the trash, so nothing was deleted. Please try again." }, 502);
    }
  }

  const { data: deleted, error: deleteError } = await supabase.from("rfps").delete().eq("id", rfp_id).select("id");
  if (deleteError || !deleted?.length) {
    // Put the folder back so the app and Drive stay consistent.
    for (const id of trashed) await trashFile(id, false).catch((e) => console.error("restore failed", e));
    return json({ error: "Could not delete the RFP." }, 500);
  }

  if (staged.length) await supabase.storage.from("rfp-documents").remove(staged);
  return json({ deleted: true, drive_folder_trashed: wantsTrash && !folderShared, drive_files_trashed: wantsTrash && folderShared });
});
