import { useQuery } from '@tanstack/react-query'
import { pastRfpsQuery, rfpSimilarQuery, rfpTagsQuery } from '@/lib/queries'
import { profileFromTags, rankWithPins } from '@/lib/similarity'

type TagRows = { tag_values: { tag_group: string; value: string } | null }[]
const flat = (rows: TagRows | null | undefined) => (rows ?? []).flatMap((r) => (r.tag_values ? [r.tag_values] : []))

/**
 * The past RFPs most like this one: the ones a person picked first, then the best by tags. `needsDoc` keeps only
 * those with a linked proposal Doc (what step 3 can build from).
 */
export function useSimilarList(rfpId: string, year: number, options: { limit: number; needsDoc?: boolean }) {
  const tags = useQuery(rfpTagsQuery(rfpId))
  const past = useQuery(pastRfpsQuery)
  const picks = useQuery(rfpSimilarQuery(rfpId))
  if (tags.isPending || past.isPending || picks.isPending) return { loading: true as const, ranked: [], failed: false, tagRows: [] as NonNullable<typeof tags.data>, picks: [] as NonNullable<typeof picks.data> }
  if (tags.error || past.error) return { loading: false as const, ranked: [], failed: true, tagRows: [] as NonNullable<typeof tags.data>, picks: [] as NonNullable<typeof picks.data> }

  const current = profileFromTags(flat(tags.data), year)
  const candidates = (past.data ?? [])
    .filter((r) => r.id !== rfpId && (!options.needsDoc || r.proposal_doc_id))
    .map((r) => {
      const y = r.submission_year ?? new Date(r.created_at).getFullYear()
      return { item: r, year: y, profile: profileFromTags(flat(r.rfp_tags), y) }
    })
  const pins = picks.data ?? []
  return {
    loading: false as const,
    failed: false,
    ranked: rankWithPins(current, candidates, pins.map((p) => p.similar_rfp_id), options.limit),
    tagRows: tags.data,
    picks: pins,
  }
}

/** The five best matches that have a Google Doc, picked ones first. The first is the default base. */
export function useBaseCandidates(rfpId: string, year: number) {
  const { loading, ranked } = useSimilarList(rfpId, year, { limit: 5, needsDoc: true })
  return { loading, ranked }
}

/** The id of the base to use: the one chosen here, else the first match. Null when there is none. */
export function chosenBaseId(ranked: { item: { id: string } }[], value: string | null): string | null {
  return ranked.find((m) => m.item.id === value)?.item.id ?? ranked[0]?.item.id ?? null
}
