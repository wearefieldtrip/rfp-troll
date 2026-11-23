// Step 4 (docs/specs/step-4-review.md): turns the model's checklist answer plus a few plain checks into one stored review,
// and words it for the profile card and the comments in the Doc. Pure, so it is tested.
// An identical copy lives in supabase/functions/proposal-review/.
import { countMentions, type El } from './proposal-plan.ts'
import type { Requirements } from './requirements.ts'

export type SectionStatus = 'complete' | 'partial' | 'missing'

export type SectionCheck = {
  title: string
  status: SectionStatus
  missingItems: string[]
  /** Pages the section takes in the PDF, or null when unknown. */
  pages: number | null
  limitPages: number | null
  overLimit: boolean
  points: string | null
  note: string
}

export type AttachmentCheck = { name: string; status: 'included' | 'referenced' | 'not_found' }
export type FormatCheck = { rule: string; status: 'ok' | 'problem' | 'cannot_check'; note: string }

export type ProposalReview = {
  checkedAt: string
  pageCount: number | null
  /** False when the RFP gave no structure, so only attachments, rules and leftovers were checked. */
  structureChecked: boolean
  sections: SectionCheck[]
  attachments: AttachmentCheck[]
  format: FormatCheck[]
  leftovers: { pastClient: string | null; pastClientMentions: number; placeholders: string[] }
  other: string[]
  /** The Drive comments this run posted, so the next run can remove them. */
  commentIds: string[]
}

const text = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '')
const SECTION_STATUS: SectionStatus[] = ['complete', 'partial', 'missing']
const index = (v: unknown, max: number): number | null => (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= max ? (v as number) - 1 : null)

/** "3 pages", "25-page limit", "no more than 10 pages" give the number. Word limits and anything else give null. */
export function pageLimitOf(limit: string | null): number | null {
  if (!limit) return null
  const m = /(\d+)\s*[- ]?\s*pages?\b/i.exec(limit)
  return m ? Number(m[1]) : null
}

/** Pages in a PDF, counted from its page objects. Null when none are found. */
export function pdfPageCount(bytes: Uint8Array): number | null {
  let raw = ''
  for (let i = 0; i < bytes.length; i += 8192) raw += String.fromCharCode(...bytes.subarray(i, i + 8192))
  const count = raw.match(/\/Type\s*\/Page(?![s\w])/g)?.length ?? 0
  return count > 0 ? count : null
}

/** All the text in a Doc's body, tables included, one paragraph per line. */
export function docPlainText(content: El[]): string {
  const lines: string[] = []
  const walk = (els: El[]) => {
    for (const el of els) {
      if (el.paragraph) lines.push((el.paragraph.elements ?? []).map((e) => e.textRun?.content ?? '').join('').replace(/\n$/, ''))
      for (const row of el.table?.tableRows ?? []) for (const cell of row.tableCells ?? []) walk(cell.content ?? [])
    }
  }
  walk(content)
  return lines.join('\n')
}

/** Placeholder text that is still in the proposal: TBD, TODO, XXX, [bracketed gaps], lorem ipsum. At most 5, each once. */
export function findPlaceholders(body: string): string[] {
  const found: string[] = []
  const add = (s: string) => {
    const t = s.trim()
    if (t && !found.includes(t)) found.push(t)
  }
  for (const m of body.matchAll(/\b(TBD|TODO|XXX+)\b/g)) add(m[1])
  for (const m of body.matchAll(/\[([^\]\n]{1,60})\]/g)) if (!/^\d+([,\s–-]+\d+)*$/.test(m[1].trim())) add(`[${m[1].trim()}]`)
  if (/lorem ipsum/i.test(body)) add('lorem ipsum')
  return found.slice(0, 5)
}

type Raw = { sections?: unknown; attachments?: unknown; format?: unknown; other?: unknown }

/** The model's answer matched back to the requirements. Anything the model didn't cover is shown as not covered, never as fine. */
export function buildReview(raw: unknown, req: Requirements, facts: { pageCount: number | null; body: string; pastClient: string | null; now?: Date }): ProposalReview {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Raw
  const items = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : [])

  const bySection = new Map<number, Record<string, unknown>>()
  for (const s of items(r.sections)) {
    const i = index(s.required, req.sections.length)
    if (i !== null && !bySection.has(i)) bySection.set(i, s)
  }
  const sections = req.sections.map((rs, i): SectionCheck => {
    const s = bySection.get(i)
    const limitPages = pageLimitOf(rs.pageLimit)
    const pagesRaw = s?.pages
    const pages = typeof pagesRaw === 'number' && Number.isFinite(pagesRaw) && pagesRaw > 0 ? Math.round(pagesRaw) : null
    const status = s && SECTION_STATUS.includes(s.status as SectionStatus) ? (s.status as SectionStatus) : 'partial'
    return {
      title: rs.title,
      status,
      missingItems: (Array.isArray(s?.missing_items) ? (s!.missing_items as unknown[]) : []).map(text).filter(Boolean).slice(0, 6),
      pages,
      limitPages,
      overLimit: limitPages !== null && pages !== null && pages > limitPages,
      points: rs.points,
      note: s ? text(s.note) : 'The check did not cover this section.',
    }
  })

  const byAttachment = new Map<number, string>()
  for (const a of items(r.attachments)) {
    const i = index(a.attachment, req.attachments.length)
    if (i !== null && !byAttachment.has(i)) byAttachment.set(i, text(a.status))
  }
  const attachments = req.attachments.map((a, i): AttachmentCheck => {
    const s = byAttachment.get(i)
    return { name: a.name, status: s === 'included' || s === 'referenced' ? s : 'not_found' }
  })

  const byRule = new Map<number, Record<string, unknown>>()
  for (const f of items(r.format)) {
    const i = index(f.rule, req.submission.formatRules.length)
    if (i !== null && !byRule.has(i)) byRule.set(i, f)
  }
  const format = req.submission.formatRules.map((rule, i): FormatCheck => {
    const f = byRule.get(i)
    const status = f?.status === 'ok' || f?.status === 'problem' ? f.status : 'cannot_check'
    return { rule, status, note: f ? text(f.note) : '' }
  })

  return {
    checkedAt: (facts.now ?? new Date()).toISOString(),
    pageCount: facts.pageCount,
    structureChecked: req.sections.length > 0,
    sections,
    attachments,
    format,
    leftovers: { pastClient: facts.pastClient, pastClientMentions: countMentions(facts.body, facts.pastClient), placeholders: findPlaceholders(facts.body) },
    other: (Array.isArray(r.other) ? r.other : []).map(text).filter(Boolean).slice(0, 5),
    commentIds: [],
  }
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** "9 of 11 sections complete · 1 attachment not found · 2 over a page limit". Parts with nothing to say are left out. */
export function reviewSummary(rv: ProposalReview): string {
  const complete = rv.sections.filter((s) => s.status === 'complete').length
  const missingAttachments = rv.attachments.filter((a) => a.status === 'not_found').length
  const over = rv.sections.filter((s) => s.overLimit).length
  const parts = [
    rv.structureChecked ? `${complete} of ${plural(rv.sections.length, 'section')} complete` : "The RFP sets no structure, so sections weren't checked",
    missingAttachments > 0 && `${plural(missingAttachments, 'attachment')} not found`,
    over > 0 && `${over} over a page limit`,
  ]
  return parts.filter(Boolean).join(' · ')
}

/** The problems, one short line each, most important first: missing sections, over limits, partial, attachments, rules, leftovers. */
export function reviewProblems(rv: ProposalReview): string[] {
  const out: string[] = []
  for (const s of rv.sections) if (s.status === 'missing') out.push(`${s.title}: missing`)
  for (const s of rv.sections) if (s.overLimit) out.push(`${s.title}: about ${plural(s.pages!, 'page')}, limit ${s.limitPages}`)
  for (const s of rv.sections) if (s.status === 'partial') out.push(`${s.title}: ${s.missingItems.length > 0 ? `not found: ${s.missingItems.join('; ')}` : s.note || 'partly covered'}`)
  for (const a of rv.attachments) if (a.status === 'not_found') out.push(`Attachment not found: ${a.name}`)
  for (const f of rv.format) if (f.status === 'problem') out.push(`${f.rule}${f.note ? `: ${f.note}` : ''}`)
  const { pastClient, pastClientMentions, placeholders } = rv.leftovers
  if (pastClientMentions > 0) out.push(`${pastClient} is still named ${plural(pastClientMentions, 'time')}`)
  if (placeholders.length > 0) out.push(`Placeholder text: ${placeholders.join(', ')}`)
  for (const o of rv.other) out.push(o)
  return out
}

/** The comments to post in the Doc: a top summary, then one per section, attachments, rules and leftovers that need a look. */
export function reviewComments(rv: ProposalReview, when: string): { top: string; items: string[] } {
  const items: string[] = []
  for (const s of rv.sections) {
    const lines: string[] = []
    if (s.status === 'missing') lines.push('Not found in the proposal.')
    else if (s.status === 'partial') lines.push(s.missingItems.length > 0 ? `Not found: ${s.missingItems.join('; ')}.` : s.note || 'Only partly covered.')
    if (s.overLimit) lines.push(`About ${plural(s.pages!, 'page')}, over the limit of ${s.limitPages}.`)
    if (lines.length > 0) items.push([`▸ Review · ${s.title}`, ...lines, s.points ? `Points: ${s.points}.` : ''].filter(Boolean).join('\n'))
  }
  const missing = rv.attachments.filter((a) => a.status === 'not_found').map((a) => a.name)
  if (missing.length > 0) items.push(`▸ Review · Attachments\nNot found in the proposal: ${missing.join('; ')}.`)
  for (const f of rv.format) if (f.status === 'problem') items.push(`▸ Review · Submission rule\n${f.rule}${f.note ? `\n${f.note}` : ''}`)
  const { pastClient, pastClientMentions, placeholders } = rv.leftovers
  const left = [pastClientMentions > 0 && `${pastClient} is still named ${plural(pastClientMentions, 'time')}.`, placeholders.length > 0 && `Placeholder text: ${placeholders.join(', ')}.`].filter(Boolean)
  if (left.length > 0) items.push(`▸ Review · Leftovers\n${left.join('\n')}`)
  if (rv.other.length > 0) items.push(`▸ Review · Other\n${rv.other.join('\n')}`)

  const top = [`AI check · ${when}. A draft checklist against the RFP's requirements; it can miss things. It never edits this Doc.`, reviewSummary(rv) + '.', rv.pageCount ? `The Doc runs ${plural(rv.pageCount, 'page')}.` : ''].filter(Boolean).join('\n\n')
  return { top, items }
}
