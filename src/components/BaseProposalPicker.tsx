import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { OUTCOME_LABELS, STAGE_LABELS } from '@/lib/import-view'
import { baseLabel } from '@/lib/proposal-view'
import { useBaseCandidates } from '@/lib/base-candidates'
import { whyMatched } from '@/lib/similarity'

type Props = {
  rfpId: string
  year: number
  /** The chosen past RFP; null means the best match. */
  value: string | null
  onChange: (id: string) => void
}

/** "Based on: [past client] proposal (year, outcome) · Change". Change shows the top five with why each matched. */
export function BaseProposalPicker({ rfpId, year, value, onChange }: Props) {
  const { loading, ranked } = useBaseCandidates(rfpId, year)
  const [changing, setChanging] = useState(false)

  if (loading) return <Skeleton className="h-10 w-full" />
  if (ranked.length === 0) {
    return (
      <p className="rounded-lg bg-muted/60 px-4 py-3 text-sm">
        No similar past proposal to start from yet. Add tags with Edit tags in the ⋯ menu, or the proposal Doc can't be created from a past one.
      </p>
    )
  }

  const chosen = ranked.find((m) => m.item.id === value) ?? ranked[0]
  const label = (m: (typeof ranked)[number]) => baseLabel(m.item.client_name, m.item.title, m.year, m.item.outcome ? (OUTCOME_LABELS[m.item.outcome] ?? m.item.outcome).toLowerCase() : null)

  return (
    <div className="space-y-2 rounded-lg bg-muted/60 px-4 py-3 text-sm">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span>
          Based on: <b className="font-semibold">{label(chosen)}</b>
        </span>
        <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => setChanging(!changing)}>
          {changing ? 'Done' : 'Change'}
        </Button>
      </p>
      {changing && (
        <ul className="divide-y rounded-md border bg-background">
          {ranked.map((m) => (
            <li key={m.item.id}>
              <label className="flex cursor-pointer items-start gap-2 px-3 py-2">
                <input type="radio" name="base-proposal" className="mt-1" checked={m.item.id === chosen.item.id} onChange={() => onChange(m.item.id)} />
                <span className="min-w-0">
                  <span className="block font-medium">{label(m)}</span>
                  <span className="block text-muted-foreground">
                    {whyMatched(m).join(' · ')}
                    {m.item.furthest_stage && m.item.outcome !== 'won' && ` · ${STAGE_LABELS[m.item.furthest_stage] ?? m.item.furthest_stage}`}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
