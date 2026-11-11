// Reads one row of the RFP tracker (docs/specs/historical-data.md, Phase A) and works out what it becomes:
// a closed RFP with a normalized outcome, and tags from the tracker's own columns (docs/specs/tagging.md, "Backfill").
// Pure, so it is tested. An identical copy lives in supabase/functions/import-tracker/.

export type Outcome = 'won' | 'lost' | 'no_response' | 'qualified' | 'unknown'
export type Stage = 'submitted' | 'finalist' | 'pitched'

/** A value the import could not map. It goes to the Review imports screen. */
export type Issue = { field: string; value: string; reason: string }

/** One data row of the sheet. `cells` is keyed by the header, with line breaks in a header turned into spaces. */
export type SheetRow = { row: number; cells: Record<string, string>; linkTitle: string; linkUrl: string | null }

export type ImportedTags = { client_type: string[]; sector: string[]; services: string[]; procurement: string[]; geography: string[] }

export type ParsedRow = {
  row: number
  key: string
  client: string
  title: string
  year: number | null
  status: 'closed_won' | 'closed_lost'
  outcome: Outcome
  stage: Stage | null
  reason: string | null
  note: string | null
  tags: ImportedTags
  issues: Issue[]
  data: Record<string, unknown>
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const cell = (row: SheetRow, name: string) => (row.cells[name] ?? '').trim()

/** A stable key for the row, so a second run finds the RFP it already made. */
export const importKey = (client: string, title: string, year: number | null) => `${norm(client)}|${norm(title)}|${year ?? ''}`

export type OutcomeRead = { outcome: Outcome; stage: Stage | null; reason: string | null; note: string | null }

/** "Did We Win?" and Response, as the tracker writes them, into an outcome, how far it got, why and a note. */
export function readOutcome(didWin: string, response: string): OutcomeRead {
  const win = norm(didWin)
  const r = norm(response)

  if (win === 'true') return { outcome: 'won', stage: null, reason: null, note: r.includes('never took off') ? 'Won, but never took off' : null }
  if (win === 'qualified') return { outcome: 'qualified', stage: 'submitted', reason: null, note: response.trim() || null }
  if (win !== 'false' && win !== '') return { outcome: 'unknown', stage: null, reason: null, note: null }
  if (r === 'n a') return { outcome: 'unknown', stage: null, reason: null, note: null }

  if (r.includes('no response')) return { outcome: 'no_response', stage: 'submitted', reason: null, note: null }
  if (r.includes('finalist')) {
    // "Pitched" but not "No Pitch" (and the tracker's own typo "No Ptich").
    return { outcome: 'lost', stage: r.includes('pitched') ? 'pitched' : 'finalist', reason: null, note: r.includes('second place') ? 'Second place' : null }
  }
  return {
    outcome: 'lost',
    stage: 'submitted',
    reason: r.includes('local agency') ? 'Local agency' : r.includes('no clarification') ? 'No clarification' : null,
    note: r.includes('months') ? 'The process took months' : null,
  }
}

const CLIENT_TYPE: Record<string, string> = {
  nonprofit: 'Nonprofit',
  noprofit: 'Nonprofit',
  philanthropy: 'Nonprofit',
  civic: 'Civic / government',
  education: 'Education',
}

// Values with no match here (Childcare, Legal, IDD, Food, Support, MPO, Airport, blanks) go to Review imports.
const SECTOR: Record<string, string> = {
  'k 12': 'K-12',
  k12: 'K-12',
  transit: 'Transit',
  environmental: 'Environmental / solid waste',
  'solid waste': 'Environmental / solid waste',
  research: 'Research',
  foundation: 'Foundation',
  tourism: 'Tourism',
  parks: 'Parks & rec',
  health: 'Health',
  healthcare: 'Health',
  state: 'State agency',
  'higher ed': 'Higher ed',
}

const PROJECT_TYPE: Record<string, string[]> = {
  brand: ['Brand strategy', 'Visual identity'],
  'brand website': ['Brand strategy', 'Visual identity', 'Website'],
  'brand marketing': ['Brand strategy', 'Visual identity', 'Campaign'],
  'brand survey': ['Brand strategy', 'Research & discovery'],
  campaign: ['Campaign'],
  'campaign creative': ['Campaign'],
  website: ['Website'],
  'marketing aor': ['Agency of record'],
  report: ['Print & reports'],
  signage: ['Signage & wayfinding'],
}

const DOCUMENT_TYPE: Record<string, string> = { rfp: 'RFP', rfi: 'RFI', rfq: 'RFQ' }

/** "KY / IN" is two states. Anything that is not a two-letter code is returned in `bad`. */
export function readStates(text: string): { states: string[]; bad: string[] } {
  const states: string[] = []
  const bad: string[] = []
  for (const part of text.split(/[\/,&]|\band\b/i).map((p) => p.trim()).filter(Boolean)) {
    const code = part.toUpperCase()
    if (/^[A-Z]{2}$/.test(code)) {
      if (!states.includes(code)) states.push(code)
    } else bad.push(part)
  }
  return { states, bad }
}

/**
 * Louisville/KY when the tracker says the work has a Louisville/KY focus, Out of state when it is out of state,
 * and only the state codes for a Kentucky RFP with no Louisville/KY focus (it is not "out of state").
 */
export function geographyTags(states: string[], kyFocus: boolean): string[] {
  const local = kyFocus ? ['Louisville/KY'] : states.length > 0 && !states.includes('KY') ? ['Out of state'] : []
  return [...local, ...states]
}

const asYear = (text: string) => (/^\d{4}$/.test(text) ? Number(text) : null)
const isTrue = (text: string) => norm(text) === 'true'

/** Null for a row with no project name (a blank row). */
export function parseRow(raw: SheetRow): ParsedRow | null {
  const client = cell(raw, 'Project')
  if (!client) return null

  const issues: Issue[] = []
  const title = raw.linkTitle.trim() || client
  const yearText = cell(raw, 'Submission Year')
  const year = asYear(yearText)
  if (year === null) issues.push({ field: 'Submission Year', value: yearText, reason: 'not a year' })

  const read = readOutcome(cell(raw, 'Did We Win?'), cell(raw, 'Response'))
  if (read.outcome === 'unknown') issues.push({ field: 'Did We Win?', value: `${cell(raw, 'Did We Win?')} / ${cell(raw, 'Response')}`, reason: 'outcome not clear' })

  const tags: ImportedTags = { client_type: [], sector: [], services: [], procurement: [], geography: [] }
  const map = (field: string, table: Record<string, string | string[]>, into: keyof ImportedTags, reason: string) => {
    const value = cell(raw, field)
    const found = table[norm(value)]
    if (found) tags[into].push(...(Array.isArray(found) ? found : [found]))
    else issues.push({ field, value, reason: value ? reason : 'blank' })
  }
  map('Client Type 1', CLIENT_TYPE, 'client_type', 'no matching client type')
  map('Client Type 2', SECTOR, 'sector', 'no matching sector')
  map('Project Type', PROJECT_TYPE, 'services', 'no matching service')
  map('Document Type', DOCUMENT_TYPE, 'procurement', 'not RFP, RFI or RFQ')

  const stateText = cell(raw, 'State')
  const { states, bad } = readStates(stateText)
  for (const b of bad) issues.push({ field: 'State', value: b, reason: 'not a two-letter state' })
  if (!stateText) issues.push({ field: 'State', value: '', reason: 'blank' })
  tags.geography = geographyTags(states, isTrue(cell(raw, 'Louisville/KY focus')))

  // The section columns (TRUE/FALSE) are kept as read, for splitting proposals into sections later.
  const NOT_SECTIONS = new Set(['Louisville/KY focus', 'Did We Win?'])
  const sections = Object.fromEntries(
    Object.entries(raw.cells)
      .filter(([name, value]) => !NOT_SECTIONS.has(name) && /^(true|false)$/i.test(value.trim()))
      .map(([name, value]) => [name, isTrue(value)]),
  )
  const caseStudies = cell(raw, 'Case Studies Used').split(/\r?\n/).map((c) => c.trim()).filter(Boolean)

  return {
    row: raw.row,
    key: importKey(client, title, year),
    client,
    title,
    year,
    status: read.outcome === 'won' ? 'closed_won' : 'closed_lost',
    outcome: read.outcome,
    stage: read.stage,
    reason: read.reason,
    note: read.note,
    tags,
    issues,
    data: {
      tracker_row: raw.row,
      link_title: raw.linkTitle.trim(),
      link_url: raw.linkUrl,
      did_we_win: cell(raw, 'Did We Win?'),
      response: cell(raw, 'Response'),
      project_type: cell(raw, 'Project Type'),
      client_type_1: cell(raw, 'Client Type 1'),
      client_type_2: cell(raw, 'Client Type 2'),
      state: stateText,
      document_type: cell(raw, 'Document Type'),
      louisville_ky_focus: isTrue(cell(raw, 'Louisville/KY focus')),
      sections,
      case_studies: caseStudies,
      prepared_by: cell(raw, 'Prepared By'),
      unique_aspects: cell(raw, 'Unique Aspects'),
    },
  }
}

/** The sheet's rows from `from` to `to` (sheet row numbers, inclusive). Either may be left out. */
export const selectRows = <T extends { row: number }>(rows: T[], from?: number, to?: number): T[] =>
  rows.filter((r) => (from === undefined || r.row >= from) && (to === undefined || r.row <= to))

export type PlanAction = 'create' | 'update' | 'skip_reviewed'

/** What running the import would do to each row, given the keys of RFPs that exist and which of those are reviewed. */
export function planActions(rows: ParsedRow[], existing: Map<string, { reviewed: boolean }>): { row: ParsedRow; action: PlanAction }[] {
  const seen = new Set<string>()
  return rows.map((row) => {
    // Two rows with the same key in one run are the same RFP: the first wins, the repeat only updates it.
    const dup = seen.has(row.key)
    seen.add(row.key)
    const found = existing.get(row.key)
    if (found?.reviewed) return { row, action: 'skip_reviewed' as const }
    return { row, action: found || dup ? ('update' as const) : ('create' as const) }
  })
}

/** Counts for the preview and the result. */
export function summarize(plan: { row: ParsedRow; action: PlanAction }[]) {
  const count = <K extends string>(items: K[]) => items.reduce<Record<string, number>>((m, k) => ({ ...m, [k]: (m[k] ?? 0) + 1 }), {})
  const unmapped = new Map<string, number>()
  for (const { row } of plan) for (const i of row.issues) unmapped.set(`${i.field}: ${i.value || '(blank)'}`, (unmapped.get(`${i.field}: ${i.value || '(blank)'}`) ?? 0) + 1)
  return {
    rows: plan.length,
    actions: count(plan.map((p) => p.action)),
    outcomes: count(plan.map((p) => p.row.outcome)),
    rowsWithIssues: plan.filter((p) => p.row.issues.length > 0).length,
    unmapped: [...unmapped.entries()].sort((a, b) => b[1] - a[1]).map(([what, rows]) => ({ what, rows })),
  }
}
