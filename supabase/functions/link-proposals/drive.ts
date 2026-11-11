// The two Drive lookups the proposal links need: what a file is, and what sits beside it.
import { getAccessToken } from "./google.ts";
import type { DriveFile, FileLookup } from "./proposal-link.ts";

const DRIVE = "https://www.googleapis.com/drive/v3";

export type FileInfo = { name: string; mimeType: string; trashed: boolean; parent: string | null };

/** What the file is, or the status Google answered with when the service account can't open it. */
export async function lookupFile(fileId: string): Promise<(FileLookup & { info?: FileInfo }) | null> {
  const res = await fetch(`${DRIVE}/files/${fileId}?supportsAllDrives=true&fields=id,name,mimeType,trashed,parents`, {
    headers: { Authorization: `Bearer ${await getAccessToken()}` },
  });
  if (!res.ok) return { ok: false, status: res.status };
  const f = await res.json();
  return { ok: true, mimeType: f.mimeType, trashed: !!f.trashed, info: { name: f.name, mimeType: f.mimeType, trashed: !!f.trashed, parent: f.parents?.[0] ?? null } };
}

/** Everything in a folder (every page), for finding the PDF beside a Doc. */
export async function listFolder(parentId: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken = "";
  do {
    const q = encodeURIComponent(`'${parentId}' in parents and trashed = false`);
    const res = await fetch(
      `${DRIVE}/files?q=${q}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=nextPageToken,files(id,name,mimeType)&pageSize=200${pageToken && `&pageToken=${encodeURIComponent(pageToken)}`}`,
      { headers: { Authorization: `Bearer ${await getAccessToken()}` } },
    );
    if (!res.ok) return files;
    const body = await res.json();
    files.push(...body.files);
    pageToken = body.nextPageToken ?? "";
  } while (pageToken);
  return files;
}
