import { ExternalLinkIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useSimilarList } from '@/lib/base-candidates'
import { OUTCOME_LABELS, STAGE_LABELS } from '@/lib/import-view'
import { profileFromTags, whyMatched } from '@/lib/similarity'

const SHOWN = 5
const MORE = 10

type TagRows = { tag_values: { tag_group: string; value: string } | null }[]
const flat = (rows: TagRows) => rows.flatMap((r) => (r.tag_values ? [r.tag_values] : []))

/** The past RFPs most like this one: ones the team picked first, then the best by tags, with how each turned out. */
export function SimilarRfps({ rfpId, year }: { rfpId: string; year: number }) {
  const [more, setMore] = useState(false)
  const list = useSimilarList(rfpId, year, { limit: MORE })

  if (list.loading) return <Skeleton className="h-32 w-full" />
  if (list.failed) return null

  const current = profileFromTags(flat(list.tagRows), year)
  const hasTags = current.services.length > 0 || current.sector !== null || current.clientType !== null
  const unconfirmed = list.tagRows.some((t) => !t.confirmed)
  const ranked = list.ranked
  const shown = more ? ranked : ranked.slice(0, SHOWN)

  return (
    <Card aria-label="Similar past RFPs">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Similar past RFPs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {!hasTags && ranked.length === 0 ? (
          <p className="text-muted-foreground">
            Nothing to compare yet. Once this RFP is tagged by the fit review, or you add tags with Edit tags in the ⋯ menu, the closest past RFPs show here.
          </p>
        ) : ranked.length === 0 ? (
          <p className="text-muted-foreground">No similar past RFPs yet.</p>
        ) : (
          <>
            <ul className="divide-y rounded-md border">
              {shown.map((m) => {
                const why = whyMatched(m)
                const outcome = m.item.outcome ? (OUTCOME_LABELS[m.item.outcome] ?? m.item.outcome) : null
                return (
                  <li key={m.item.id} className="space-y-1 px-4 py-3.5">
                    <p className="flex flex-wrap items-baseline gap-x-3">
                      <Link to={`/rfps/${m.item.id}`} className="min-w-0 flex-1 font-medium break-words underline-offset-4 hover:underline">
                        {m.item.client_name ?? m.item.title}
                      </Link>
                      <span className="text-muted-foreground">
                        {m.year} · {outcome}
                        {m.item.furthest_stage && m.item.outcome !== 'won' && ` · ${STAGE_LABELS[m.item.furthest_stage] ?? m.item.furthest_stage}`}
                      </span>
                    </p>
                    <p className="text-muted-foreground">{why.join(' · ')}</p>
                    {m.item.proposal_doc_id && (
                      <a
                        href={`https://docs.google.com/document/d/${m.item.proposal_doc_id}/edit`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-muted-foreground underline underline-offset-4"
                      >
                        Proposal Doc
                        <ExternalLinkIcon className="size-3" aria-hidden />
                      </a>
                    )}
                  </li>
                )
              })}
            </ul>
            {ranked.length > SHOWN && (
              <Button variant="ghost" size="sm" onClick={() => setMore(!more)}>
                {more ? 'Show fewer' : `Show ${ranked.length - SHOWN} more`}
              </Button>
            )}
          </>
        )}

        <p className="text-xs text-muted-foreground">
          Matched on tags: services, sector, client type, topics and budget, with newer RFPs counting more.
          {unconfirmed && " This RFP's tags are AI-set; fix them with Edit tags if they look wrong."}
        </p>
      </CardContent>
    </Card>
  )
}
