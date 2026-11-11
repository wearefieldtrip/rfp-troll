// Works out which Google Doc an imported RFP's proposal link points at, whether it can be opened, and which PDF in the
// same folder is its export. Pure, so it is tested. An identical copy lives in supabase/functions/link-proposals/.

export type LinkStatus = 'linked' | 'no_access' | 'not_a_doc' | 'no_link'

const DOC_MIME = 'application/vnd.google-apps.document'
const PDF_MIME = 'application/pdf'

/** The file id in a Google link ("/document/d/ID/edit", "/file/d/ID/view", "?id=ID"), or null. */
export function fileIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const id = /\/d\/([\w-]{20,})/.exec(url)?.[1] ?? /[?&]id=([\w-]{20,})/.exec(url)?.[1]
  return id ?? null
}

/** A name for comparing: no extension, case, spacing or punctuation. */
export const normalizeName = (name: string) =>
  name
    .replace(/\.(pdf|docx?|gdoc)$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export type DriveFile = { id: string; name: string; mimeType: string }

/**
 * The PDF beside the Doc that is its export: same name (ignoring the extension), or the only PDF whose name starts with
 * the Doc's name. Null when there is none, or when several fit and nobody can say which.
 */
export function pickPdf(docName: string, siblings: DriveFile[]): string | null {
  const want = normalizeName(docName)
  if (!want) return null
  const pdfs = siblings.filter((f) => f.mimeType === PDF_MIME)
  const exact = pdfs.filter((f) => normalizeName(f.name) === want)
  if (exact.length > 0) return exact[0].id
  if (want.length < 10) return null
  const longer = pdfs.filter((f) => normalizeName(f.name).startsWith(want))
  return longer.length === 1 ? longer[0].id : null
}

export type FileLookup = { ok: true; mimeType: string; trashed: boolean } | { ok: false; status: number }

/** What the check of one link means. A trashed Doc counts as not reachable. */
export function classifyLink(url: string | null | undefined, lookup: FileLookup | null): LinkStatus {
  if (!fileIdFromUrl(url) || !lookup) return 'no_link'
  if (!lookup.ok || lookup.trashed) return 'no_access'
  return lookup.mimeType === DOC_MIME ? 'linked' : 'not_a_doc'
}

export const LINK_STATUS_LABELS: Record<LinkStatus, string> = {
  linked: 'Linked',
  no_access: 'Can\'t open it',
  not_a_doc: 'Not a Google Doc',
  no_link: 'No link',
}

export const isPdf = (mimeType: string) => mimeType === PDF_MIME
