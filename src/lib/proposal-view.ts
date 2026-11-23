// How the proposal step reads on screen: the build summary line and the base-proposal choices.

export type DraftSummary = {
  kept: number
  added: number
  removed: number
  checks: { title: string; flags: string[] }[]
  moves: string[]
  base: { client: string | null; year: number; outcome: string }
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** "Kept 5 sections, added 2, removed 4 · 3 sections to check for old client details". Null if there is nothing stored. */
export function draftSummaryLine(raw: unknown): string | null {
  const s = raw as Partial<DraftSummary> | null
  if (!s || typeof s !== 'object' || typeof s.kept !== 'number') return null
  const parts = [`Kept ${plural(s.kept, 'section')}`, `added ${s.added ?? 0}`, `removed ${s.removed ?? 0}`].join(', ')
  const check = Array.isArray(s.checks) ? s.checks.length : 0
  const moves = Array.isArray(s.moves) ? s.moves.length : 0
  const more = [check > 0 && `${plural(check, 'section')} to check`, moves > 0 && `${plural(moves, 'move')} to make`].filter(Boolean)
  return more.length > 0 ? `${parts} · ${more.join(' · ')}` : parts
}

/** "Hunger Task Force proposal (2025, won)". */
export const baseLabel = (client: string | null, title: string, year: number, outcome: string | null) =>
  `${client ?? title} proposal (${year}${outcome ? `, ${outcome.replace('_', ' ')}` : ''})`
