import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLinkIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useSimilarList } from '@/lib/base-candidates'
import { OUTCOME_LABELS, STAGE_LABELS } from '@/lib/import-view'
import { pastRfpsQuery } from '@/lib/queries'
import { profileFromTags, trackRecord, whyMatched } from '@/lib/similarity'
import { supabase } from '@/lib/supabase'

const SHOWN = 5
const MORE = 10

type TagRows = { tag_values: { tag_group: string; value: string } | null }[]
const flat = (rows: TagRows) => rows.flatMap((r) => (r.tag_values ? [r.tag_values] : []))

/** Adds or removes a past RFP the team picked as similar. Picked ones always show first. */
function usePicks(rfpId: string) {
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['rfps', rfpId, 'similar'] })
  const add = useMutation({
    mutationFn: async (similarId: string) => {
      const { error } = await supabase.from('rfp_similar').insert({ rfp_id: rfpId, similar_rfp_id: similarId })
      if (error) throw error
    },
    onSettled: refresh,
  })
  const remove = useMutation({
    mutationFn: async (pickId: string) => {
      const { error } = await supabase.from('rfp_similar').delete().eq('id', pickId)
      if (error) throw error
    },
    onSettled: refresh,
  })
  return { add, remove }
}

/** A search over every past RFP by client or title. */
function PickSearch({ rfpId, pickedIds, onPick, onDone }: { rfpId: string; pickedIds: Set<string>; onPick: (id: string) => void; onDone: () => void }) {
  const past = useQuery(pastRfpsQuery)
  const [text, setText] = useState('')
  const q = text.trim().toLowerCase()
  const matches = (past.data ?? [])
    .filter((r) => r.id !== rfpId && !pickedIds.has(r.id))
    .filter((r) => !q || `${r.client_name ?? ''} ${r.title}`.toLowerCase().includes(q))
    .slice(0, 8)

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex gap-2">
        <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Search past RFPs by client or title" aria-label="Search past RFPs" />
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Done
        </Button>
      </div>
      {past.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : matches.length === 0 ? (
        <p className="text-sm text-muted-foreground">No past RFP matches.</p>
      ) : (
        <ul className="divide-y">
          {matches.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => onPick(r.id)} className="flex w-full items-baseline gap-3 py-2 text-left text-sm hover:bg-muted/50">
                <span className="min-w-0 flex-1 font-medium break-words">{r.client_name ?? r.title}</span>
                <span className="text-muted-foreground">
                  {r.submission_year ?? new Date(r.created_at).getFullYear()}
                  {r.outcome ? ` · ${OUTCOME_LABELS[r.outcome] ?? r.outcome}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** The past RFPs most like this one: ones the team picked first, then the best by tags, with how each turned out. */
export function SimilarRfps({ rfpId, year }: { rfpId: string; year: number }) {
  const [more, setMore] = useState(false)
  const [searching, setSearching] = useState(false)
  const list = useSimilarList(rfpId, year, { limit: MORE })
  const { add, remove } = usePicks(rfpId)

  if (list.loading) return <Skeleton className="h-32 w-full" />
  if (list.failed) return null

  const current = profileFromTags(flat(list.tagRows), year)
  const hasTags = current.services.length > 0 || current.sector !== null || current.clientType !== null
  const unconfirmed = list.tagRows.some((t) => !t.confirmed)
  const ranked = list.ranked
  const shown = more ? ranked : ranked.slice(0, SHOWN)
  const record = trackRecord(ranked.slice(0, SHOWN).map((m) => ({ outcome: m.item.outcome, stage: m.item.furthest_stage })))
  const pickOf = (id: string) => list.picks.find((p) => p.similar_rfp_id === id)
  const pickedIds = new Set(list.picks.map((p) => p.similar_rfp_id))

  return (
    <Card aria-label="Similar past RFPs">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Similar past RFPs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {!hasTags && ranked.length === 0 ? (
          <p className="text-muted-foreground">
            Nothing to compare yet. Once this RFP is tagged by the fit review, or you add tags with Edit tags in the ⋯ menu, the closest past RFPs show here. You can also pick one yourself.
          </p>
        ) : ranked.length === 0 ? (
          <p className="text-muted-foreground">No similar past RFPs yet.</p>
        ) : (
          <>
            {record && <p className="font-medium">{record}</p>}
            <ul className="divide-y rounded-md border">
              {shown.map((m) => {
                const why = whyMatched(m)
                const pick = pickOf(m.item.id)
                const by = pick?.profiles?.full_name ?? pick?.profiles?.email
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
                      {m.pinned && (
                        <button
                          type="button"
                          aria-label={`Remove ${m.item.client_name ?? m.item.title} from your picks`}
                          disabled={remove.isPending}
                          onClick={() => pick && remove.mutate(pick.id)}
                          className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <XIcon className="size-3.5" aria-hidden />
                        </button>
                      )}
                    </p>
                    <p className="text-muted-foreground">
                      {m.pinned ? `Picked${by ? ` by ${by}` : ''}${why.length ? ` · ${why.join(' · ')}` : ''}` : why.join(' · ')}
                    </p>
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

        {searching ? (
          <PickSearch
            rfpId={rfpId}
            pickedIds={pickedIds}
            onPick={(id) => add.mutate(id)}
            onDone={() => setSearching(false)}
          />
        ) : (
          <Button variant="outline" size="sm" onClick={() => setSearching(true)}>
            Add a past RFP
          </Button>
        )}
        {(add.error || remove.error) && <p className="text-destructive">That change didn't save. Please try again.</p>}

        <p className="text-xs text-muted-foreground">
          Picked RFPs come first. The rest are matched on tags: services, sector, client type, topics and budget, with newer RFPs counting more.
          {unconfirmed && " This RFP's tags are AI-set; fix them with Edit tags if they look wrong."}
        </p>
      </CardContent>
    </Card>
  )
}
