import type { HistoryEntry } from '@/lib/history'

const formatWhen = (entry: HistoryEntry) =>
  entry.dateLabel ?? new Date(entry.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })

/** Everything that has happened to this RFP, newest first. It sits beside the steps on wide screens and under them on narrow ones. */
export function HistoryPanel({ entries }: { entries: HistoryEntry[] }) {
  return (
    <section aria-label="History" className="space-y-3">
      <h2 className="border-b pb-2 text-sm font-semibold">History</h2>
      <ol className="space-y-4 border-l pl-4 text-sm">
        {entries.map((e) => (
          <li key={e.id} className="relative min-w-0">
            <span className="absolute top-1.5 -left-[1.3125rem] size-2 rounded-full bg-foreground/40" aria-hidden />
            <p className="font-medium break-words">{e.title}</p>
            {e.detail && <p className="text-muted-foreground">{e.detail}</p>}
            {e.note && <p className="text-muted-foreground italic break-words">{e.note}</p>}
            <p className="text-xs text-muted-foreground">
              {formatWhen(e)}
              {e.who && ` · ${e.who}`}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}
