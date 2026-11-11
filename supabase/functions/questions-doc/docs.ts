// Google Docs and Drive calls for the questions doc, as the service account.
import { getAccessToken } from "./google.ts";
import type { DocElement } from "./questions-doc.ts";

const DRIVE = "https://www.googleapis.com/drive/v3";
const DOCS = "https://docs.googleapis.com/v1/documents";

async function failure(res: Response, action: string) {
  const body = await res.json().catch(() => null);
  return new Error(`Google could not ${action} (${res.status}): ${body?.error?.message ?? res.statusText}`);
}

const headers = async () => ({ Authorization: `Bearer ${await getAccessToken()}`, "Content-Type": "application/json" });

export async function copyDoc(templateId: string, name: string, parentId: string): Promise<string> {
  const res = await fetch(`${DRIVE}/files/${templateId}/copy?supportsAllDrives=true&fields=id`, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({ name, parents: [parentId] }),
  });
  if (!res.ok) throw await failure(res, "copy the questions template");
  return (await res.json()).id;
}

export type Doc = { body?: { content?: DocElement[] } };

/** Suggestions are shown inline, so a doc with pending suggestions can be told apart from a clean one. */
export async function getDoc(docId: string): Promise<Doc> {
  const res = await fetch(`${DOCS}/${docId}?suggestionsViewMode=SUGGESTIONS_INLINE`, { headers: await headers() });
  if (!res.ok) throw await failure(res, "read the questions doc");
  return await res.json();
}

/** Normal edits, or, with `suggest`, edits that land as suggestions for the team to accept or reject. */
export async function batchUpdate(docId: string, requests: object[], suggest = false): Promise<{ suggestionResponses?: { createdSuggestionIds?: string[] }[] }> {
  const res = await fetch(`${DOCS}/${docId}:batchUpdate`, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({ requests, ...(suggest ? { writeControl: { writeMode: "SUGGEST" } } : {}) }),
  });
  if (!res.ok) throw await failure(res, suggest ? "add the suggestions" : "edit the questions doc");
  return await res.json();
}

/** A comment on the whole doc. Google doesn't reliably anchor comments made this way, so it isn't tied to a place. */
export async function addComment(fileId: string, content: string): Promise<void> {
  const res = await fetch(`${DRIVE}/files/${fileId}/comments?fields=id`, { method: "POST", headers: await headers(), body: JSON.stringify({ content }) });
  if (!res.ok) throw await failure(res, "add a comment");
}
