// The requirements list: what the RFP asks the proposal to contain (docs/specs/step-3-proposal.md, job 1).
// The model returns it; this cleans it so what is stored is always the same shape. Step 4 checks the proposal against it.
// An identical copy lives in supabase/functions/requirements/.

export type RequiredSection = {
  title: string
  order: number
  mustAddress: string[]
  pageLimit: string | null
  points: string | null
  source: string | null
}

export type Requirements = {
  sections: RequiredSection[]
  attachments: { name: string; source: string | null }[]
  submission: { due: string | null; method: string | null; formatRules: string[] }
}

const text = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '')
const orNull = (v: unknown): string | null => text(v) || null
const list = (v: unknown, max: number): string[] => (Array.isArray(v) ? v.map(text).filter(Boolean).slice(0, max) : [])

/** Keeps the RFP's own order, drops empty or repeated sections, and caps each list. */
export function cleanRequirements(raw: unknown): Requirements {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const seen = new Set<string>()
  const sections = (Array.isArray(r.sections) ? r.sections : [])
    .map((s, i) => {
      const o = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>
      return {
        title: text(o.title),
        order: typeof o.order === 'number' && Number.isFinite(o.order) ? o.order : i + 1,
        mustAddress: list(o.must_address, 6),
        pageLimit: orNull(o.page_limit),
        points: orNull(o.points),
        source: orNull(o.source),
      }
    })
    .filter((s) => {
      const key = s.title.toLowerCase()
      if (!s.title || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => a.order - b.order)
    .map((s, i) => ({ ...s, order: i + 1 }))

  const attachments = (Array.isArray(r.attachments) ? r.attachments : [])
    .map((a) => {
      const o = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>
      return { name: text(o.name), source: orNull(o.source) }
    })
    .filter((a) => a.name)

  const s = (r.submission && typeof r.submission === 'object' ? r.submission : {}) as Record<string, unknown>
  const due = orNull(s.due)
  return {
    sections,
    attachments,
    submission: { due: due && !Number.isNaN(Date.parse(due)) ? due : null, method: orNull(s.method), formatRules: list(s.format_rules, 8) },
  }
}

/** "7 required sections · 3 attachments · 25-page limit". Pieces with nothing to say are left out. */
export function requirementsSummary(req: Requirements): string {
  const n = req.sections.length
  const parts = [
    `${n} required section${n === 1 ? '' : 's'}`,
    req.attachments.length > 0 && `${req.attachments.length} attachment${req.attachments.length === 1 ? '' : 's'}`,
    req.submission.formatRules.find((r) => /page/i.test(r)),
  ]
  return parts.filter(Boolean).join(' · ')
}
