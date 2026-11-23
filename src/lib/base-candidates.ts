import { useQuery } from '@tanstack/react-query'
import { pastRfpsQuery, rfpTagsQuery } from '@/lib/queries'
import { profileFromTags, rankSimilar } from '@/lib/similarity'

type TagRows = { tag_values: { tag_group: string; value: string } | null }[]
const flat = (rows: TagRows | null | undefined) => (rows ?? []).flatMap((r) => (r.tag_values ? [r.tag_values] : []))

/** The five most similar past proposals that have a Google Doc, best first. The first is the default base. */
export function useBaseCandidates(rfpId: string, year: number) {
  const tags = useQuery(rfpTagsQuery(rfpId))
  const past = useQuery(pastRfpsQuery)
  if (tags.isPending || past.isPending) return { loading: true as const, ranked: [] }

  const current = profileFromTags(flat(tags.data), year)
  const candidates = (past.data ?? [])
    .filter((r) => r.id !== rfpId && r.proposal_doc_id)
    .map((r) => {
      const y = r.submission_year ?? new Date(r.created_at).getFullYear()
      return { item: r, year: y, profile: profileFromTags(flat(r.rfp_tags), y) }
    })
  return { loading: false as const, ranked: rankSimilar(current, candidates, 5) }
}


/** The id of the base to use: the one picked, else the best match. Null when there is none. */
export function chosenBaseId(ranked: { item: { id: string } }[], value: string | null): string | null {
  return ranked.find((m) => m.item.id === value)?.item.id ?? ranked[0]?.item.id ?? null
}
