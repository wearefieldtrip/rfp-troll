// The rubric is edited in a Google Doc (docs/specs/step-1-evaluate.md, "Rubric"). The Doc is read as markdown, which
// Google writes its own way: bold headings, numbered lists, escaped punctuation. This turns that into the plain form the
// rubric is stored in and checked against (docs/fit-rubric.md), so how the team formats the Doc doesn't matter.
// An identical copy lives in supabase/functions/rubric-doc/ (functions deploy independently).

export const RUBRIC_DOC_ID = '1zP6vPrQ8eo5Sotjg-77BqfKtFQIlOhwUI1gzbxv0EBs'
export const RUBRIC_DOC_URL = `https://docs.google.com/document/d/${RUBRIC_DOC_ID}/edit`

/** Google's markdown export, turned into the rubric's own plain markdown. */
export function normalizeRubricDoc(exported: string): string {
  const lines = exported
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .split('\n')
    .map((line) =>
      line
        // "## **A. Name**" -> "## A. Name"
        .replace(/^(#{1,6})\s+\*\*(.+?)\*\*\s*$/, '$1 $2')
        // numbered or starred lists become dashes, so "1.  **3 – Excellent:**" reads like the rubric's own lines
        .replace(/^\s*(?:\d+[.)]|[*+•])\s+/, '- ')
        // Google escapes punctuation, e.g. "Q\&A"
        .replace(/\\([\\`*_{}[\]()#+\-.!&<>|~])/g, '$1')
        .replace(/\s+$/, ''),
    )
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

export type DiffLine = { kind: 'same' | 'added' | 'removed'; text: string }

/** A line-by-line comparison of two versions of the rubric, in reading order. */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.trim().split('\n')
  const b = after.trim().split('\n')
  // Longest common subsequence of lines; the rubric is a few dozen lines, so the table is tiny.
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: 'same', text: a[i] })
      i++
      j++
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      out.push({ kind: 'removed', text: a[i++] })
    } else {
      out.push({ kind: 'added', text: b[j++] })
    }
  }
  while (i < a.length) out.push({ kind: 'removed', text: a[i++] })
  while (j < b.length) out.push({ kind: 'added', text: b[j++] })
  return out
}

/** Only the lines that changed, each with the heading they sit under, so a change can be placed without the whole text. */
export function changesOnly(lines: DiffLine[]): { heading: string; kind: 'added' | 'removed'; text: string }[] {
  let heading = ''
  const out: { heading: string; kind: 'added' | 'removed'; text: string }[] = []
  for (const l of lines) {
    if (l.kind !== 'added' && /^#{1,6}\s/.test(l.text)) heading = l.text.replace(/^#{1,6}\s+/, '')
    if (l.kind !== 'same') out.push({ heading, kind: l.kind, text: l.text })
  }
  return out
}
