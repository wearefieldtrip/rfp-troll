// Reads the questions template (a Google Doc) and plans the edits that turn it into one RFP's questions doc.
// Pure functions over the Docs API's JSON, so they are tested here. An identical copy lives in supabase/functions/questions-doc/.

type TextRun = { textRun?: { content?: string } }

export type DocElement = {
  startIndex?: number
  endIndex?: number
  paragraph?: {
    elements?: TextRun[]
    paragraphStyle?: { namedStyleType?: string }
    bullet?: { nestingLevel?: number }
  }
  table?: unknown
}

/** One library question with everything that belongs to it: its answer options, a table, trailing blank lines. */
export type BankGroup = {
  /** The question's number in the library, counting from 0. */
  index: number
  start: number
  end: number
  /** The question and its options, as plain text for the model that picks which ones fit. */
  text: string
}

export type TemplateLayout = {
  groups: BankGroup[]
  /** Where the "Guidelines:" section begins. It is for the team, never for the client, so it is cut. */
  guidelinesStart: number | null
  /** The end of the document body. The last character can't be deleted. */
  docEnd: number
}

const paragraphText = (el: DocElement) =>
  (el.paragraph?.elements ?? []).map((e) => e.textRun?.content ?? '').join('').replace(/\n$/, '')

export function parseTemplate(content: DocElement[]): TemplateLayout {
  const groups: BankGroup[] = []
  let guidelinesStart: number | null = null
  let current: BankGroup | null = null
  const docEnd = content.reduce((max, el) => Math.max(max, el.endIndex ?? 0), 0)

  for (const el of content) {
    if (el.startIndex === undefined || el.endIndex === undefined) continue

    if (el.table) {
      if (current) {
        current.end = el.endIndex
        current.text += '\n   [a table to fill in]'
      }
      continue
    }
    if (!el.paragraph) continue

    const text = paragraphText(el)
    const level = el.paragraph.bullet ? (el.paragraph.bullet.nestingLevel ?? 0) : null

    if (level === null && /^guidelines\b/i.test(text.trim())) {
      guidelinesStart = el.startIndex
      break
    }
    if (level === 0 && text.trim()) {
      current = { index: groups.length, start: el.startIndex, end: el.endIndex, text: text.trim() }
      groups.push(current)
    } else if (current) {
      current.end = el.endIndex
      if (level !== null && text.trim()) current.text += `\n   - ${text.trim()}`
    }
  }
  return { groups, guidelinesStart, docEnd }
}

/** The library as a numbered list for the model. */
export const bankForPrompt = (groups: BankGroup[]) => groups.map((g) => `${g.index + 1}. ${g.text}`).join('\n')

/** Keeps only valid, distinct positions from the model's answer. */
export function cleanKeep(keep: unknown, count: number): Set<number> {
  const kept = new Set<number>()
  if (!Array.isArray(keep)) return kept
  for (const n of keep) if (Number.isInteger(n) && n >= 1 && n <= count) kept.add(n - 1)
  return kept
}

/**
 * Edits that cut the guidelines and every library question that was not kept.
 * Highest position first, so each delete leaves the positions of the ones still to come untouched.
 */
export function cutRequests(layout: TemplateLayout, keep: Set<number>) {
  const requests: object[] = []
  if (layout.guidelinesStart !== null && layout.guidelinesStart < layout.docEnd - 1) {
    requests.push({ deleteContentRange: { range: { startIndex: layout.guidelinesStart, endIndex: layout.docEnd - 1 } } })
  }
  for (const group of [...layout.groups].reverse()) {
    if (keep.has(group.index)) continue
    // A group that runs into the guidelines can't reach past where they start.
    const end = layout.guidelinesStart === null ? group.end : Math.min(group.end, layout.guidelinesStart)
    if (end > group.start) requests.push({ deleteContentRange: { range: { startIndex: group.start, endIndex: end } } })
  }
  return requests
}

/** The header lines the app can fill in. The contact is left for the team. */
export function fillRequests(fields: { title: string; clientName: string | null; date: string }) {
  const requests: object[] = [
    { replaceAllText: { containsText: { text: 'RFP:\t#', matchCase: true }, replaceText: `RFP:\t${fields.title}` } },
    { replaceAllText: { containsText: { text: 'DATE:\tDATE', matchCase: true }, replaceText: `DATE:\t${fields.date}` } },
  ]
  if (fields.clientName) {
    requests.push({ replaceAllText: { containsText: { text: 'CLIENT', matchCase: true }, replaceText: fields.clientName } })
  }
  return requests
}

/** Where the suggested questions go: just above the first library question that is left. */
export function firstQuestionStart(content: DocElement[]): number | null {
  for (const el of content) {
    if (el.paragraph?.bullet && (el.paragraph.bullet.nestingLevel ?? 0) === 0 && paragraphText(el).trim() && el.startIndex !== undefined) {
      return el.startIndex
    }
  }
  return null
}

const oneLine = (q: string) => q.replace(/\s+/g, ' ').trim()

/** Suggested questions inserted as new list items above the library questions. */
export function suggestRequest(at: number, questions: string[]) {
  const text = questions.map(oneLine).filter(Boolean).map((q) => `${q}\n`).join('')
  return text ? { insertText: { location: { index: at }, text } } : null
}

/** How many questions the team is about to send. */
export function countQuestions(content: DocElement[]): number {
  let count = 0
  for (const el of content) {
    const level = el.paragraph?.bullet ? (el.paragraph.bullet.nestingLevel ?? 0) : null
    // The guidelines, if still there, are not questions.
    if (el.paragraph && level === null && /^guidelines\b/i.test(paragraphText(el).trim())) break
    if (level === 0 && paragraphText(el).trim()) count++
  }
  return count
}

/** Suggestions nobody has accepted or rejected yet. Sending then would send an unfinished doc. */
export function pendingSuggestions(doc: unknown): number {
  const ids = new Set<string>()
  const walk = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(walk)
    if (value && typeof value === 'object') {
      for (const [key, inner] of Object.entries(value)) {
        if ((key === 'suggestedInsertionIds' || key === 'suggestedDeletionIds') && Array.isArray(inner)) inner.forEach((id) => ids.add(String(id)))
        else walk(inner)
      }
    }
  }
  walk(doc)
  return ids.size
}
