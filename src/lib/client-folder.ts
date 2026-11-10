// Picks the Drive folder for a client: reuse one that already exists under Prospective Clients, else make a new one.

/** Lowercase, no punctuation, "&" as "and", no leading "the": "The Smith Foundation, Inc." matches "smith foundation inc". */
export function normalizeClientName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the /, '')
}

type Folder = { id: string; name: string; mimeType: string }

const FOLDER = 'application/vnd.google-apps.folder'

/** Looks only at direct children, skips helper folders that start with "_", and needs an exact match once normalized. */
export function findClientFolder(children: Folder[], clientName: string): Folder | null {
  const wanted = normalizeClientName(clientName)
  if (!wanted) return null
  return children.find((f) => f.mimeType === FOLDER && !f.name.startsWith('_') && normalizeClientName(f.name) === wanted) ?? null
}
