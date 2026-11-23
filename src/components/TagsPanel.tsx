import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { rfpReviewsQuery, rfpTagsQuery } from '@/lib/queries'
import { TAG_GROUPS } from '@/lib/tag-groups'

/** What this RFP is tagged with, grouped, under the history. Tags the AI suggested and nobody has confirmed show lighter. */
export function TagsPanel({ rfpId, onEdit }: { rfpId: string; onEdit: () => void }) {
  const { data, isPending } = useQuery(rfpTagsQuery(rfpId))
  // The fit review sets the AI tags, so while one is running they are being rechecked.
  const reviews = useQuery(rfpReviewsQuery(rfpId))
  const rechecking = reviews.data?.[0]?.status === 'running'
  const tags = (data ?? []).flatMap((t) => (t.tag_values ? [{ group: t.tag_values.tag_group, value: t.tag_values.value, confirmed: t.confirmed }] : []))
  const groups = TAG_GROUPS.map((g) => ({ ...g, items: tags.filter((t) => t.group === g.key).sort((a, b) => a.value.localeCompare(b.value)) })).filter((g) => g.items.length > 0)

  return (
    <section aria-label="Tags" className="space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <h2 className="text-sm font-semibold">Tags</h2>
        <Button variant="ghost" size="sm" className="-my-1 -mr-2 text-muted-foreground" onClick={onEdit}>
          Edit
        </Button>
      </div>
      {rechecking ? (
        <div className="space-y-4" aria-label="Tags are being rechecked">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <div className="flex gap-1.5">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : isPending ? null : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tags yet. Add some so similar past RFPs can be found.</p>
      ) : (
        <dl className="space-y-4 text-sm">
          {groups.map((g) => (
            <div key={g.key}>
              <dt className="text-xs text-muted-foreground">{g.label}</dt>
              <dd className="mt-1.5 flex flex-wrap gap-1.5">
                {g.items.map((t) => (
                  <span key={t.value} className={`rounded-full border px-2.5 py-0.5 text-xs ${t.confirmed ? '' : 'text-muted-foreground'}`}>
                    {t.value}
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
