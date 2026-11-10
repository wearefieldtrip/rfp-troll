// Minimal Google Drive client for the RFP Troll service account.
// Identical copies live in each function folder that needs it (functions deploy independently).
import { importPKCS8, SignJWT } from "npm:jose@5";

type ServiceAccount = { client_email: string; private_key: string };

const DRIVE = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set for this project.");
  const account = JSON.parse(raw) as ServiceAccount;

  const key = await importPKCS8(account.private_key, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/drive" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(account.client_email)
    .setSubject(account.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`Google sign-in failed (${res.status}).`);
  const body = await res.json();
  cachedToken = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cachedToken.token;
}

async function failure(res: Response, action: string) {
  const body = await res.json().catch(() => null);
  const detail = body?.error?.message ?? res.statusText;
  return new Error(`Google Drive could not ${action} (${res.status}): ${detail}`);
}

async function authHeaders(extra: Record<string, string> = {}) {
  return { Authorization: `Bearer ${await getAccessToken()}`, ...extra };
}

/** Drive allows "/" in names but it reads badly; keep names short and tidy. */
export const tidyName = (name: string) => name.replace(/[\\/]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 200);

export async function createFolder(name: string, parentId: string): Promise<{ id: string; name: string }> {
  const res = await fetch(`${DRIVE}/files?supportsAllDrives=true&fields=id,name`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ name: tidyName(name), mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  if (!res.ok) throw await failure(res, "create a folder");
  return await res.json();
}

/** Resumable upload, so large RFPs aren't limited by the simple-upload size. */
export async function uploadFile(name: string, parentId: string, mimeType: string, bytes: ArrayBuffer): Promise<string> {
  const start = await fetch(`${UPLOAD}/files?uploadType=resumable&supportsAllDrives=true&fields=id`, {
    method: "POST",
    headers: await authHeaders({
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mimeType,
      "X-Upload-Content-Length": String(bytes.byteLength),
    }),
    body: JSON.stringify({ name, parents: [parentId] }),
  });
  if (!start.ok) throw await failure(start, "start an upload");
  const location = start.headers.get("Location");
  if (!location) throw new Error("Google Drive did not return an upload location.");

  const put = await fetch(location, { method: "PUT", headers: { "Content-Type": mimeType }, body: bytes });
  if (!put.ok) throw await failure(put, "upload a file");
  return (await put.json()).id as string;
}

export async function downloadFile(fileId: string): Promise<ArrayBuffer> {
  const res = await fetch(`${DRIVE}/files/${fileId}?alt=media&supportsAllDrives=true`, { headers: await authHeaders() });
  if (!res.ok) throw await failure(res, "download a file");
  return await res.arrayBuffer();
}

/** Moves a file or folder to the Drive trash (recoverable), or restores it with trashed = false. */
export async function trashFile(fileId: string, trashed = true): Promise<void> {
  const res = await fetch(`${DRIVE}/files/${fileId}?supportsAllDrives=true`, {
    method: "PATCH",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ trashed }),
  });
  if (!res.ok) throw await failure(res, trashed ? "trash a file" : "restore a file");
}

/** Moves a file or folder to a new parent and returns the parent it came from. */
export async function moveFile(fileId: string, newParentId: string): Promise<string> {
  const lookup = await fetch(`${DRIVE}/files/${fileId}?supportsAllDrives=true&fields=parents`, { headers: await authHeaders() });
  if (!lookup.ok) throw await failure(lookup, "look up a folder");
  const oldParent = ((await lookup.json()).parents as string[] | undefined)?.[0];
  if (!oldParent) throw new Error("Google Drive did not report where the folder currently lives.");
  if (oldParent === newParentId) return oldParent;

  const res = await fetch(
    `${DRIVE}/files/${fileId}?supportsAllDrives=true&addParents=${newParentId}&removeParents=${oldParent}&fields=id`,
    { method: "PATCH", headers: await authHeaders({ "Content-Type": "application/json" }), body: "{}" },
  );
  if (!res.ok) throw await failure(res, "move a folder");
  return oldParent;
}

export async function listChildren(parentId: string): Promise<{ id: string; name: string; mimeType: string }[]> {
  const q = encodeURIComponent(`'${parentId}' in parents and trashed = false`);
  const res = await fetch(`${DRIVE}/files?q=${q}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType)&pageSize=100`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw await failure(res, "list a folder");
  return (await res.json()).files;
}

/** The folder a file or folder currently sits in, or null when Drive doesn't say. */
export async function parentOf(fileId: string): Promise<string | null> {
  const res = await fetch(`${DRIVE}/files/${fileId}?supportsAllDrives=true&fields=parents`, { headers: await authHeaders() });
  if (!res.ok) throw await failure(res, "look up a folder");
  return ((await res.json()).parents as string[] | undefined)?.[0] ?? null;
}
