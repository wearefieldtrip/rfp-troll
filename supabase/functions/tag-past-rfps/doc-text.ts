// A Google Doc as plain text, for the AI to read.
import { getAccessToken } from "./google.ts";

const MAX_CHARS = 100_000;

export async function docText(docId: string): Promise<string> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${docId}/export?mimeType=text%2Fplain`, {
    headers: { Authorization: `Bearer ${await getAccessToken()}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(`Google could not read the proposal (${res.status}): ${body?.error?.message ?? res.statusText}`);
  }
  // A very long proposal is cut: its start says what the work is.
  return (await res.text()).slice(0, MAX_CHARS).trim();
}
