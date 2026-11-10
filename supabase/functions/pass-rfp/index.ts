import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { moveFile } from "./google.ts";

// "_DEAD Opportunities", inside Prospective Clients.
const DEAD_FOLDER_ID = Deno.env.get("DRIVE_DEAD_FOLDER_ID") ?? "0B22CMSUAolRUVHRRNTdReUVxVW8";
const BUSY_MS = 10 * 60 * 1000;
const PASSABLE = ["evaluate_ready", "questions_drafting", "questions_sent", "questions_answers_in", "proposal_drafting", "proposal_in_review"];
const REASONS = ["Budget", "Timeline", "Not a fit", "Capacity", "Scope", "Other"];

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

  // Runs as the signed-in user, so row-level security applies.
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (userError || !userData.user) return json({ error: "Not signed in" }, 401);

  const { rfp_id, reason, note } = await req.json().catch(() => ({}));
  if (typeof rfp_id !== "string") return json({ error: "rfp_id is required" }, 400);
  // Checked before anything moves, so a bad request never leaves a folder in the wrong place.
  if (typeof reason !== "string" || !REASONS.includes(reason)) return json({ error: "Choose a reason for passing." }, 400);
  const cleanNote = typeof note === "string" && note.trim() ? note.trim().slice(0, 2000) : null;

  const { data: rfp, error } = await supabase
    .from("rfps")
    .select("id, status, drive_folder_id, drive_status, updated_at")
    .eq("id", rfp_id)
    .single();
  if (error || !rfp) return json({ error: "RFP not found" }, 404);
  if (!PASSABLE.includes(rfp.status)) return json({ error: "This RFP can't be passed on from its current status." }, 409);
  if (rfp.drive_status === "syncing" && Date.now() - new Date(rfp.updated_at).getTime() < BUSY_MS) {
    return json({ error: "The Drive folder is still being set up. Try again in a minute." }, 409);
  }

  // The client's folder can hold other RFPs. Only move it when none of them is still open.
  let sharedWithActive = false;
  if (rfp.drive_folder_id) {
    const { data: others } = await supabase
      .from("rfps")
      .select("id")
      .eq("drive_folder_id", rfp.drive_folder_id)
      .neq("id", rfp_id)
      .not("status", "in", "(closed_won,closed_lost,closed_passed)")
      .limit(1);
    sharedWithActive = !!others?.length;
  }
  const moveFolder = !!rfp.drive_folder_id && !sharedWithActive;

  // Drive first: if the move fails, nothing has changed.
  let originalParent: string | null = null;
  if (moveFolder) {
    try {
      originalParent = await moveFile(rfp.drive_folder_id, DEAD_FOLDER_ID);
    } catch (err) {
      console.error("drive move failed", err);
      return json({ error: "Could not move the Drive folder to _DEAD Opportunities, so the RFP was not marked as passed. Please try again." }, 502);
    }
  }

  // The status change and the decision record happen together in the database.
  const { error: decideError } = await supabase.rpc("decide_rfp", {
    p_rfp_id: rfp_id,
    p_decision: "pass",
    p_reason: reason,
    p_note: cleanNote ?? undefined,
    p_expected_status: rfp.status,
  });

  if (decideError) {
    // Put the folder back so Drive and the app stay in agreement.
    if (moveFolder && originalParent && originalParent !== DEAD_FOLDER_ID) {
      await moveFile(rfp.drive_folder_id!, originalParent).catch((e) => console.error("move back failed", e));
    }
    console.error("decide failed", decideError);
    return json({ error: decideError.message || "Could not save the decision. Please try again." }, 409);
  }

  return json({ passed: true, folder_moved: moveFolder, folder_kept_open: sharedWithActive });
});
