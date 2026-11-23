// Plans the edits that turn a copy of a past proposal into the first draft for a new RFP (docs/specs/step-3-proposal.md, job 2).
// Pure functions over the Docs API's JSON, so they are tested here. An identical copy lives in supabase/functions/proposal-doc/.
// The plan only keeps, removes, renames, adds empty headings and clears pricing. It never writes copy.

type Run = { startIndex?: number; endIndex?: number; textRun?: { content?: string }; inlineObjectElement?: unknown }

export type El = {
  startIndex?: number
  endIndex?: number
  paragraph?: { elements?: Run[]; paragraphStyle?: { namedStyleType?: string } }
  table?: { tableRows?: { tableCells?: { content?: El[] }[] }[] }
}

export type Section = {
  /** Position among the proposal's sections, from 0. */
  index: number
  title: string
  /** Where the heading paragraph starts and ends, and where its text starts and ends (before the line break). */
  start: number
  headingEnd: number
  textEnd: number
  /** Where the section ends: the next section's start, or the end of the body. */
  end: number
  /** Everything under the heading, as plain text. */
  body: string
  images: number
}

export type Parsed = { sections: Section[]; level: number; docEnd: number; coverEnd: number }

const HEADING = /^HEADING_([1-6])$/

function paragraphText(el: El): string {
  return (el.paragraph?.elements ?? []).map((e) => e.textRun?.content ?? '').join('').replace(/\n$/, '')
}

/** Every paragraph, including those inside tables, in order. */
function paragraphs(content: El[]): El[] {
  const out: El[] = []
  for (const el of content) {
    if (el.paragraph) out.push(el)
    for (const row of el.table?.tableRows ?? []) for (const cell of row.tableCells ?? []) out.push(...paragraphs(cell.content ?? []))
  }
  return out
}

/**
 * The proposal's sections. A section is a heading at the highest heading level used in the doc (Heading 1, or Heading 2 if
 * that is the top), and runs to the next one, so sub-headings stay with their section. What comes before the first
 * section is the cover and stays as it is.
 */
export function parseSections(content: El[]): Parsed {
  const docEnd = content.reduce((max, el) => Math.max(max, el.endIndex ?? 0), 0)
  const heads = content.flatMap((el) => {
    const m = HEADING.exec(el.paragraph?.paragraphStyle?.namedStyleType ?? '')
    return m && paragraphText(el).trim() && el.startIndex !== undefined && el.endIndex !== undefined ? [{ el, level: Number(m[1]) }] : []
  })
  if (heads.length === 0) return { sections: [], level: 1, docEnd, coverEnd: docEnd }
  const level = Math.min(...heads.map((h) => h.level))
  const tops = heads.filter((h) => h.level === level)

  const sections = tops.map((h, i): Section => {
    const start = h.el.startIndex!
    const headingEnd = h.el.endIndex!
    const end = i + 1 < tops.length ? tops[i + 1].el.startIndex! : Math.max(headingEnd, docEnd - 1)
    const under = paragraphs(content.filter((el) => (el.startIndex ?? 0) >= headingEnd && (el.startIndex ?? 0) < end))
    return {
      index: i,
      title: paragraphText(h.el).trim(),
      start,
      headingEnd,
      textEnd: headingEnd - 1,
      end,
      body: under.map(paragraphText).filter((t) => t.trim()).join('\n'),
      images: under.reduce((n, p) => n + (p.paragraph?.elements ?? []).filter((e) => e.inlineObjectElement).length, 0),
    }
  })
  return { sections, level, docEnd, coverEnd: sections[0].start }
}

export type RequiredLite = { title: string; mustAddress: string[]; pageLimit: string | null; points: string | null }

export type Mapping = { matches: Map<number, number>; pricing: Set<number> }

/** Keeps only valid positions, and each section and each required section at most once. Numbers count from 1 in the prompt. */
export function cleanMapping(raw: unknown, sectionCount: number, requiredCount: number): Mapping {
  const r = (raw && typeof raw === 'object' ? raw : {}) as { matches?: unknown; pricing?: unknown }
  const matches = new Map<number, number>()
  const usedRequired = new Set<number>()
  for (const m of Array.isArray(r.matches) ? r.matches : []) {
    const o = (m && typeof m === 'object' ? m : {}) as { section?: unknown; required?: unknown }
    if (!Number.isInteger(o.section) || !Number.isInteger(o.required)) continue
    const s = (o.section as number) - 1
    const q = (o.required as number) - 1
    if (s < 0 || s >= sectionCount || q < 0 || q >= requiredCount || matches.has(s) || usedRequired.has(q)) continue
    matches.set(s, q)
    usedRequired.add(q)
  }
  const pricing = new Set<number>()
  for (const n of Array.isArray(r.pricing) ? r.pricing : []) if (Number.isInteger(n) && n >= 1 && n <= sectionCount) pricing.add((n as number) - 1)
  return { matches, pricing }
}

/** Heading text that names a cost or price, as a backstop for the model's pricing list. */
export const looksLikePricing = (title: string) => /\b(cost|costs|price|prices|pricing|fee|fees|budget|investment|rates?)\b/i.test(title)

export type Plan = {
  /** Body edits, highest position first so each leaves the positions of the ones still to come untouched. */
  requests: object[]
  kept: { section: Section; required: number; pricingCleared: boolean }[]
  removed: Section[]
  /** Required sections that had no match, with where their heading goes. */
  added: { required: number; before: number | null }[]
}

type Op = { pos: number; requests: object[] }

/**
 * What to do with each section: delete the unmatched ones, rename the matched ones to the RFP's name, clear the body
 * of pricing sections, and add an empty heading for each required section that had no match.
 */
export function planEdits(parsed: Parsed, required: RequiredLite[], mapping: Mapping): Plan {
  const ops: Op[] = []
  const kept: Plan['kept'] = []
  const removed: Section[] = []

  for (const s of parsed.sections) {
    const q = mapping.matches.get(s.index)
    if (q === undefined) {
      removed.push(s)
      if (s.end > s.start) ops.push({ pos: s.start, requests: [{ deleteContentRange: { range: { startIndex: s.start, endIndex: s.end } } }] })
      continue
    }
    const pricingCleared = mapping.pricing.has(s.index) || looksLikePricing(required[q].title)
    kept.push({ section: s, required: q, pricingCleared })

    const title = required[q].title
    if (title !== s.title) {
      // Insert at the end of the old text so the new text takes its look, then remove the old text.
      ops.push({
        pos: s.start,
        requests: [
          { insertText: { location: { index: s.textEnd }, text: title } },
          { deleteContentRange: { range: { startIndex: s.start, endIndex: s.textEnd } } },
        ],
      })
    }
    if (pricingCleared && s.end > s.headingEnd) {
      ops.push({ pos: s.headingEnd, requests: [{ deleteContentRange: { range: { startIndex: s.headingEnd, endIndex: s.end } } }] })
    }
  }

  // Required sections with no match: an empty heading just before the first kept section that the RFP asks for later.
  const keptOrder = kept.map((k) => ({ start: k.section.start, order: k.required }))
  const matchedRequired = new Set(kept.map((k) => k.required))
  const byAnchor = new Map<number, number[]>()
  const added: Plan['added'] = []
  required.forEach((_, q) => {
    if (matchedRequired.has(q)) return
    const next = keptOrder.filter((k) => k.order > q).sort((a, b) => a.start - b.start)[0]
    const at = next ? next.start : parsed.docEnd - 1
    byAnchor.set(at, [...(byAnchor.get(at) ?? []), q])
    added.push({ required: q, before: next ? next.order : null })
  })
  for (const [at, qs] of byAnchor) {
    const atEnd = at === parsed.docEnd - 1
    const ordered = qs.sort((a, b) => a - b)
    // At the end of the doc the text joins the last paragraph, so it starts with a line break.
    const text = (atEnd ? '\n' : '') + ordered.map((q) => required[q].title).join('\n') + (atEnd ? '' : '\n')
    const styles: object[] = []
    let offset = at + (atEnd ? 1 : 0)
    for (const q of ordered) {
      const end = offset + required[q].title.length + 1
      styles.push({
        updateParagraphStyle: { range: { startIndex: offset, endIndex: end }, paragraphStyle: { namedStyleType: `HEADING_${parsed.level}` }, fields: 'namedStyleType' },
      })
      offset = end
    }
    ops.push({ pos: at, requests: [{ insertText: { location: { index: at }, text } }, ...styles] })
  }

  // Higher position first. An insertion and a delete that meet at one position can't overlap, so ties are harmless.
  ops.sort((a, b) => b.pos - a.pos)
  return { requests: ops.flatMap((o) => o.requests), kept, removed, added }
}

type Move = { title: string; after: string | null }

/**
 * The moves needed to put the sections in the RFP's order. The Docs API can't move content, so these become one
 * comment for the team. Sections already in a good relative order stay put; the others move.
 */
export function orderMoves(plan: Plan, required: RequiredLite[]): Move[] {
  // The doc's order after the edits: kept sections where they are, added ones before the kept section they precede.
  const inDoc: number[] = []
  const keptByOrder = [...plan.kept].sort((a, b) => a.section.start - b.section.start)
  const addedBefore = new Map<number | null, number[]>()
  for (const a of plan.added) addedBefore.set(a.before, [...(addedBefore.get(a.before) ?? []), a.required])
  for (const k of keptByOrder) {
    inDoc.push(...(addedBefore.get(k.required) ?? []).sort((a, b) => a - b))
    inDoc.push(k.required)
  }
  inDoc.push(...(addedBefore.get(null) ?? []).sort((a, b) => a - b))

  // Longest run that is already in increasing order stays; everything else moves.
  const best: number[] = inDoc.map(() => 1)
  const prev: number[] = inDoc.map(() => -1)
  let top = 0
  inDoc.forEach((v, i) => {
    for (let j = 0; j < i; j++) {
      if (inDoc[j] < v && best[j] + 1 > best[i]) {
        best[i] = best[j] + 1
        prev[i] = j
      }
    }
    if (best[i] > best[top]) top = i
  })
  const stay = new Set<number>()
  for (let i = inDoc.length ? top : -1; i >= 0; i = prev[i]) stay.add(inDoc[i])

  return inDoc
    .filter((q) => !stay.has(q))
    .sort((a, b) => a - b)
    .map((q) => ({ title: required[q].title, after: q === 0 ? null : required[q - 1].title }))
}

export const moveText = (m: Move) => (m.after ? `Move “${m.title}” to just after “${m.after}”` : `Move “${m.title}” to the top`)

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** How many times a name appears. Names under 3 letters are too likely to be a piece of another word. */
export function countMentions(text: string, name: string | null): number {
  if (!name || name.trim().length < 3) return 0
  return text.match(new RegExp(escape(name.trim()), 'gi'))?.length ?? 0
}

/** Dollar amounts, percentages and big numbers, which go stale between proposals. */
export const hasFigures = (text: string) => /\$\s?\d|\d\s?%|\b\d{1,3}(?:,\d{3})+\b|\b\d+(?:\.\d+)?\s?(?:million|thousand|billion)\b/i.test(text)

/** What to check in a kept section, in a few words each. Empty when there is nothing to flag. */
export function sectionFlags(section: Pick<Section, 'body' | 'images'>, pastClient: string | null): string[] {
  const flags: string[] = []
  const mentions = countMentions(section.body, pastClient)
  if (mentions > 0) flags.push(`mentions ${pastClient} ${mentions} time${mentions === 1 ? '' : 's'}`)
  if (hasFigures(section.body)) flags.push('contains figures to verify')
  if (section.images > 0) flags.push(`${section.images} image${section.images === 1 ? '' : 's'} to check`)
  return flags
}

export type Replacement = { startIndex: number; endIndex: number; text: string }

/**
 * Where the past client's name or the past RFP's title appears in text runs, and what replaces each.
 * Names are replaced in the header, footer and cover only; elsewhere they are flagged for the team.
 */
export function findReplacements(content: El[], swaps: { from: string | null; to: string | null }[], before = Infinity): Replacement[] {
  const usable = swaps.filter((s): s is { from: string; to: string } => !!s.from && s.from.trim().length >= 3 && !!s.to).sort((a, b) => b.from.length - a.from.length)
  if (usable.length === 0) return []
  const pattern = new RegExp(usable.map((s) => escape(s.from.trim())).join('|'), 'gi')
  const out: Replacement[] = []
  for (const p of paragraphs(content)) {
    for (const run of p.paragraph?.elements ?? []) {
      const text = run.textRun?.content
      if (!text || run.startIndex === undefined) continue
      for (const m of text.matchAll(pattern)) {
        const start = run.startIndex + (m.index ?? 0)
        if (start >= before) continue
        const swap = usable.find((s) => s.from.trim().toLowerCase() === m[0].toLowerCase())
        if (swap) out.push({ startIndex: start, endIndex: start + m[0].length, text: swap.to })
      }
    }
  }
  return out
}

/** Replacements as edits, highest position first. Each puts the new text at the end of the old so it keeps the look. */
export const replacementRequests = (found: Replacement[], segmentId?: string) =>
  [...found]
    .sort((a, b) => b.startIndex - a.startIndex)
    .flatMap((r) => [
      { insertText: { location: { index: r.endIndex, ...(segmentId ? { segmentId } : {}) }, text: r.text } },
      { deleteContentRange: { range: { startIndex: r.startIndex, endIndex: r.endIndex, ...(segmentId ? { segmentId } : {}) } } },
    ])
