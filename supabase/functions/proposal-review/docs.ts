// Google Docs and Drive calls for the proposal review, as the service account. Read-only on the Doc itself:
// the review only reads it and adds or removes its own comments.
import { getAccessToken } from "./google.ts";
import type { El } from "./proposal-plan.ts";

const DRIVE = "https://www.googleapis.com/drive/v3";
const DOCS = "https://docs.googleapis.com/v1/documents";

async function failure(res: Response, action: string) {
  const body = await res.json().catch(() => null);
  return new Error(`Google could not ${action} (${res.status}): ${body?.error?.message ?? res.statusText}`);
}

const headers = async () => ({ Authorization: `Bearer ${await getAccessToken()}`, "Content-Type": "application/json" });

export async function getDocBody(docId: string): Promise<El[]> {
  const res = await fetch(`${DOCS}/${docId}`, { headers: await headers() });
  if (!res.ok) throw await failure(res, "read the proposal doc");
  return ((await res.json()) as { body?: { content?: El[] } }).body?.content ?? [];
}

/** A comment on the whole doc. Google doesn't reliably anchor comments made this way, so each one names its section. */
export async function addComment(fileId: string, content: string): Promise<string | null> {
  const res = await fetch(`${DRIVE}/files/${fileId}/comments?fields=id`, { method: "POST", headers: await headers(), body: JSON.stringify({ content }) });
  if (!res.ok) throw await failure(res, "add a comment");
  return ((await res.json()) as { id?: string }).id ?? null;
}

/** Removes a comment this service account posted earlier. A comment that is already gone is fine. */
export async function deleteComment(fileId: string, commentId: string): Promise<void> {
  const res = await fetch(`${DRIVE}/files/${fileId}/comments/${commentId}`, { method: "DELETE", headers: await headers() });
  if (!res.ok && res.status !== 404) throw await failure(res, "remove an earlier comment");
}
