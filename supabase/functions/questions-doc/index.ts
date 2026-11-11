import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { addComment, batchUpdate, copyDoc, getDoc } from "./docs.ts";
import { downloadFile, tidyName, trashFile } from "./google.ts";
import { countQuestions, cutRequests, fillRequests, parseTemplate, pendingSuggestions, questionStarts, suggestRequests } from "./questions-doc.ts";
import { selectBankQuestions, type RfpFile } from "./select-bank.ts";

// Provided by the Supabase Edge runtime; keeps a task alive after the response is sent.
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const TEMPLATE_ID = Deno.env.get("QUESTIONS_TEMPLATE_DOC_ID") ?? "1NpFoM4e281R9xHumZGbDZTH3SwphHNQrrMw41hWyCmE";
const BUILD_STALE_MS = 5 * 60 * 1000;

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
  status: string;
  drive_folder_id: string | null;
  drive_rfp_subfolder_id: string | null;
  questions_doc_id: string | null;
  questions_doc_status: string | null;
  questions_suggestions_status: string | null;
  updated_at: string;
};

const COLUMNS =
  "id, title, client_name, status, drive_folder_id, drive_rfp_subfolder_id, questions_doc_id, questions_doc_status, questions_suggestions_status, updated_at";

const COMMENT = (count: number) =>
  `RFP Troll added ${count} suggested question${count === 1 ? "" : "s"} from the fit review, shown as separate suggestions among the questions. Accept or reject each one, then send the doc. Delete this comment before sending.`;

const longDate = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", dateStyle: "long" }).format(d);

const targetFolder = (rfp: Rfp) => rfp.drive_rfp_subfolder_id ?? rfp.drive_folder_id;

/** The questions from the latest finished fit review, which become suggestions in the doc. */
async function reviewQuestions(supabase: SupabaseClient, rfpId: string): Promise<string[]> {
  const { data } = await supabase
    .from("rfp_reviews")
    .select("result")
    .eq("rfp_id", rfpId)
    .eq("status", "complete")
    .order("created_at", { ascending: false })
    .limit(1);
  const questions = (data?.[0]?.result as { questions?: unknown } | undefined)?.questions;
  return Array.isArray(questions) ? questions.filter((q): q is string => typeof q === "string" && q.trim().length > 0) : [];
}

/** Adds the fit review's questions as separate suggestions, each above a different library question, and says so in a comment. */
async function addSuggestions(supabase: SupabaseClient, rfp: Rfp, docId: string) {
  const questions = await reviewQuestions(supabase, rfp.id);
  const setSuggestions = (patch: Record<string, unknown>) => supabase.from("rfps").update(patch).eq("id", rfp.id);

  if (questions.length === 0) {
    await setSuggestions({ questions_suggestions_status: "added", questions_suggested_count: 0 });
    return;
  }
  try {
    const doc = await getDoc(docId);
    const content = doc.body?.content ?? [];
    // Questions beyond the library questions go to the end of the doc.
    const requests = suggestRequests(questionStarts(content), Math.max(1, (content[content.length - 1]?.endIndex ?? 2) - 1), questions);
    if (requests.length === 0) throw new Error("There were no questions to suggest.");

    const result = await batchUpdate(docId, requests, true);
    // Edits can save even when the suggestion part didn't, so look at what Google says it created.
    if (!result.suggestionResponses?.some((r) => r.createdSuggestionIds?.length)) throw new Error("Google did not create the suggestions.");
    await addComment(docId, COMMENT(questions.length)).catch((err) => console.error("suggestion comment failed", err));
    await setSuggestions({ questions_suggestions_status: "added", questions_suggested_count: questions.length });
  } catch (err) {
    console.error("suggestions failed", err);
    await setSuggestions({ questions_suggestions_status: "failed" });
  }
}

async function build(supabase: SupabaseClient, rfp: Rfp) {
  const setDoc = (patch: Record<string, unknown>) => supabase.from("rfps").update(patch).eq("id", rfp.id);
  try {
    const folder = targetFolder(rfp);
    if (!folder) throw new Error("This RFP has no Drive folder yet.");

    // A retry starts over, so a half-built doc never lingers beside the new one.
    if (rfp.questions_doc_id) await trashFile(rfp.questions_doc_id).catch((err) => console.error("old doc not trashed", err));

    const { data: docs } = await supabase
      .from("rfp_documents")
      .select("file_name, drive_file_id")
      .eq("rfp_id", rfp.id)
      .is("superseded_at", null)
      .not("drive_file_id", "is", null);
    const files: RfpFile[] = [];
    for (const doc of docs ?? []) files.push({ name: doc.file_name, bytes: await downloadFile(doc.drive_file_id!) });

    const docId = await copyDoc(TEMPLATE_ID, tidyName(`Questions – ${rfp.title}`), folder);
    // Saved right away so a retry knows which copy to clear away.
    await setDoc({ questions_doc_id: docId });

    const layout = parseTemplate((await getDoc(docId)).body?.content ?? []);
    if (layout.groups.length === 0) throw new Error("The questions template has no questions in the expected list format.");
    const keep = await selectBankQuestions(layout.groups, files);

    await batchUpdate(docId, [...cutRequests(layout, keep), ...fillRequests({ title: rfp.title, clientName: rfp.client_name, date: longDate(new Date()) })]);
    await setDoc({ questions_doc_status: "ready", questions_doc_error: null, questions_bank_count: keep.size, questions_suggestions_status: null, questions_suggested_count: null });
    await addSuggestions(supabase, rfp, docId);
  } catch (err) {
    console.error("questions doc failed", err);
    await setDoc({ questions_doc_status: "failed", questions_doc_error: err instanceof Error ? err.message : "The questions doc could not be created." });
  }
}

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

  const { rfp_id, action, sent_on } = await req.json().catch(() => ({}));
  if (typeof rfp_id !== "string") return json({ error: "rfp_id is required" }, 400);

  const { data, error } = await supabase.from("rfps").select(COLUMNS).eq("id", rfp_id).single();
  if (error || !data) return json({ error: "RFP not found" }, 404);
  const rfp = data as Rfp;

  if (action === "build") {
    if (rfp.status !== "questions_drafting") return json({ error: "This RFP is not in Questions · Drafting." }, 409);
    if (rfp.questions_doc_status === "building" && Date.now() - new Date(rfp.updated_at).getTime() < BUILD_STALE_MS) {
      return json({ status: "building" }, 202);
    }
    await supabase.from("rfps").update({ questions_doc_status: "building", questions_doc_error: null }).eq("id", rfp_id);
    EdgeRuntime.waitUntil(build(supabase, rfp));
    return json({ status: "building" }, 202);
  }

  if (action === "suggest") {
    if (rfp.questions_doc_status !== "ready" || !rfp.questions_doc_id) return json({ error: "The questions doc isn't ready yet." }, 409);
    if (rfp.questions_suggestions_status === "added") return json({ error: "The suggestions are already in the doc." }, 409);
    await addSuggestions(supabase, rfp, rfp.questions_doc_id);
    return json({ status: "done" });
  }

  if (action === "send") {
    if (rfp.status !== "questions_drafting") return json({ error: "This RFP is not in Questions · Drafting." }, 409);
    if (rfp.questions_doc_status !== "ready" || !rfp.questions_doc_id) return json({ error: "The questions doc isn't ready yet." }, 409);
    if (typeof sent_on !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(sent_on) || Number.isNaN(Date.parse(sent_on))) return json({ error: "Choose the date it was sent." }, 400);
    const doc = await getDoc(rfp.questions_doc_id).catch((err: Error) => err);
    if (doc instanceof Error) return json({ error: doc.message }, 502);
    const pending = pendingSuggestions(doc);
    if (pending > 0) {
      return json({ error: `${pending} suggestion${pending === 1 ? " is" : "s are"} still waiting in the doc. Accept or reject each one first, so what you send is final.` }, 409);
    }

    const { data: updated, error: updateError } = await supabase
      .from("rfps")
      .update({ status: "questions_sent", questions_sent_on: sent_on, questions_sent_at: new Date().toISOString(), questions_sent_count: countQuestions(doc.body?.content ?? []) })
      .eq("id", rfp_id)
      .eq("status", "questions_drafting")
      .select("id");
    if (updateError || !updated?.length) return json({ error: "Could not save that the questions were sent." }, 502);
    return json({ status: "sent" });
  }

  return json({ error: "Unknown action" }, 400);
});
