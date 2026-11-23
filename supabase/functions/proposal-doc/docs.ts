// Google Docs and Drive calls for the proposal doc, as the service account.
import { getAccessToken } from "./google.ts";
import type { El } from "./proposal-plan.ts";

const DRIVE = "https://www.googleapis.com/drive/v3";
const DOCS = "https://docs.googleapis.com/v1/documents";

async function failure(res: Response, action: string) {
  const body = await res.json().catch(() => null);
  return new Error(`Google could not ${action} (${res.status}): ${body?.error?.message ?? res.statusText}`);
}

const headers = async () => ({ Authorization: `Bearer ${await getAccessToken()}`, "Content-Type": "application/json" });

export async function copyDoc(sourceId: string, name: string, parentId: string): Promise<string> {
  const res = await fetch(`${DRIVE}/files/${sourceId}/copy?supportsAllDrives=true&fields=id`, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({ name, parents: [parentId] }),
  });
  if (!res.ok) throw await failure(res, "copy the past proposal");
  return (await res.json()).id;
}

export type Segment = { content?: El[] };
export type Doc = { body?: { content?: El[] }; headers?: Record<string, Segment>; footers?: Record<string, Segment> };

export async function getDoc(docId: string): Promise<Doc> {
  const res = await fetch(`${DOCS}/${docId}`, { headers: await headers() });
  if (!res.ok) throw await failure(res, "read the proposal doc");
  return await res.json();
}

export async function batchUpdate(docId: string, requests: object[]): Promise<void> {
  if (requests.length === 0) return;
  const res = await fetch(`${DOCS}/${docId}:batchUpdate`, { method: "POST", headers: await headers(), body: JSON.stringify({ requests }) });
  if (!res.ok) throw await failure(res, "edit the proposal doc");
}

/** A comment on the whole doc. Google doesn't reliably anchor comments made this way, so each one names its section. */
export async function addComment(fileId: string, content: string): Promise<void> {
  const res = await fetch(`${DRIVE}/files/${fileId}/comments?fields=id`, { method: "POST", headers: await headers(), body: JSON.stringify({ content }) });
  if (!res.ok) throw await failure(res, "add a comment");
}

export async function trashFile(fileId: string): Promise<void> {
  const res = await fetch(`${DRIVE}/files/${fileId}?supportsAllDrives=true`, { method: "PATCH", headers: await headers(), body: JSON.stringify({ trashed: true }) });
  if (!res.ok) throw await failure(res, "trash a file");
}
