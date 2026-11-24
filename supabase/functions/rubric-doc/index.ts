import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { exportDocAsMarkdown, serviceAccountEmail } from "./google.ts";
import { normalizeRubricDoc, RUBRIC_DOC_ID } from "./rubric-doc.ts";
import { checkRubric } from "./rubric-structure.ts";

// The rubric is edited in a Google Doc. A person checks it here, sees what changed, and publishes it as the next
// version. Reviews use the last published version, so an edit in progress never changes a score.

const DOC_ID = Deno.env.get("RUBRIC_DOC_ID") ?? RUBRIC_DOC_ID;

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
  if (!Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")) return json({ error: "GOOGLE_SERVICE_ACCOUNT_JSON is not set for this project." }, 500);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization" }, 401);

  // Runs as the signed-in user, so row-level security applies.
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (userError || !userData.user) return json({ error: "Not signed in" }, 401);

  const { action, expected } = await req.json().catch(() => ({}));
  if (action !== "check" && action !== "publish") return json({ error: "action must be check or publish" }, 400);

  const doc = await exportDocAsMarkdown(DOC_ID);
  if (!doc.ok) {
    if (doc.status === 403 || doc.status === 404) {
      return json({ error: "access", serviceAccount: serviceAccountEmail(), message: "The app can't open the rubric Doc. Share it with the service account as Viewer." }, 200);
    }
    return json({ error: `Google Drive could not read the rubric Doc (${doc.status}): ${doc.detail}` }, 502);
  }

  const proposed = normalizeRubricDoc(doc.text);
  const { problems } = checkRubric(proposed);

  const { data: current } = await supabase.from("rubrics").select("version, content").eq("is_active", true).maybeSingle();
  const same = !!current && current.content?.trim() === proposed.trim();

  if (action === "check") {
    return json({ problems, proposed, current: current ? { version: current.version, content: current.content } : null, changed: !same });
  }

  // Publish: only a Doc that passes the check, and only the text the person was shown.
  if (problems.length > 0) return json({ error: "The Doc needs fixing before it can be published.", problems }, 409);
  if (typeof expected !== "string" || expected.trim() !== proposed.trim()) {
    return json({ error: "The Doc changed since you checked it. Check it again to see the latest changes." }, 409);
  }
  if (same) return json({ published: false, version: current!.version });

  const { error: saveError } = await supabase.rpc("save_rubric_version", { p_content: proposed });
  if (saveError) {
    console.error("save_rubric_version failed", saveError);
    return json({ error: "Could not save the new version. Please try again." }, 500);
  }
  const { data: now } = await supabase.from("rubrics").select("version").eq("is_active", true).maybeSingle();
  return json({ published: true, version: now?.version ?? null });
});
