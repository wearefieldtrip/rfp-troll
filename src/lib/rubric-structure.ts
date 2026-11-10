// The fit rubric has a fixed structure (docs/specs/step-1-evaluate.md, "Rubric rules"): four dimensions A to D,
// each scored 0 to 3, total out of 12, and a decision matrix of ranges. Only the wording may change.
// An identical copy lives in supabase/functions/review-rfp/ (functions deploy independently).

export const DIMENSION_KEYS = ['A', 'B', 'C', 'D'] as const
export type DimensionKey = (typeof DIMENSION_KEYS)[number]

export const DIMENSION_NAMES: Record<DimensionKey, string> = {
  A: 'Mission and segment',
  B: 'Budget and value',
  C: 'Scope and relationship',
  D: 'Timeline and capacity',
}

export const SCALE_MAX = 3
export const MAX_TOTAL = DIMENSION_KEYS.length * SCALE_MAX

export type Band = { min: number; max: number; label: string }

/** Reads the decision matrix lines, such as "- **10 – 12 · Definite Go:** Proceed to...". */
export function parseBands(content: string): Band[] {
  const heading = /^#{1,3}\s*decision matrix\s*$/im.exec(content)
  if (!heading) return []

  const after = content.slice(heading.index + heading[0].length)
  const next = /^#{1,3}\s/m.exec(after)
  const section = next ? after.slice(0, next.index) : after

  const bands: Band[] = []
  for (const line of section.split('\n')) {
    const m = /^\s*[-*]\s+\*\*\s*(\d+)\s*[–—-]\s*(\d+)\s*[·•|]\s*(.+?)\s*:?\s*\*\*/.exec(line)
    if (m) bands.push({ min: Number(m[1]), max: Number(m[2]), label: m[3].trim() })
  }
  return bands
}

function bandProblems(bands: Band[]): string[] {
  if (bands.length === 0) {
    return ['The decision matrix is missing or can\'t be read. Each line should look like "- **10 – 12 · Definite Go:** What to do".']
  }
  const sorted = [...bands].sort((a, b) => a.min - b.min)
  const covers =
    sorted[0].min === 0 &&
    sorted[sorted.length - 1].max === MAX_TOTAL &&
    sorted.every((b, i) => b.min <= b.max && (i === 0 || b.min === sorted[i - 1].max + 1))
  return covers ? [] : [`The decision matrix must cover every total from 0 to ${MAX_TOTAL} with no gaps or overlaps.`]
}

/** Checks that rubric text still has the fixed structure. An empty problem list means it is usable. */
export function checkRubric(content: string): { problems: string[]; bands: Band[] } {
  const problems: string[] = []

  for (const key of DIMENSION_KEYS) {
    const start = new RegExp(`^##\\s+${key}\\.\\s+\\S`, 'm').exec(content)
    if (!start) {
      problems.push(`Dimension ${key} is missing. It needs a heading like "## ${key}. Name".`)
      continue
    }
    const rest = content.slice(start.index + start[0].length)
    const next = /^##\s/m.exec(rest)
    const section = next ? rest.slice(0, next.index) : rest

    const levels = new Set([...section.matchAll(/^\s*[-*]\s+\*\*([0-3])\b/gm)].map((m) => Number(m[1])))
    for (let score = SCALE_MAX; score >= 0; score--) {
      if (!levels.has(score)) problems.push(`Dimension ${key} needs a line for score ${score}, like "- **${score} – Label:** What earns it".`)
    }
  }

  const bands = parseBands(content)
  problems.push(...bandProblems(bands))
  return { problems, bands }
}

/** The band a total falls in, or null when none matches. */
export function bandFor(total: number, bands: Band[]): Band | null {
  return bands.find((b) => total >= b.min && total <= b.max) ?? null
}

/** Older reviews stored the band as "7 – 9 · Conditional Go". Show just the name. */
export function cleanBandLabel(label: string | null): string {
  if (!label) return ''
  const parts = label.split('·')
  return parts[parts.length - 1].trim()
}
