import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  BAND_TONES,
  maxTotal,
  newBand,
  newDimension,
  toDraft,
  toPayload,
  validateDraft,
  type BandTone,
  type DraftBand,
  type DraftDimension,
  type DraftLevel,
  type RubricDraft,
} from '@/lib/rubric-draft'
import type { Rubric } from '@/lib/queries'
import { supabase } from '@/lib/supabase'

const selectClass =
  'h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

export function RubricEditor({
  rubric,
  onDone,
}: {
  rubric: Rubric
  onDone: (newRubricId?: string) => void
}) {
  const [draft, setDraft] = useState<RubricDraft>(() => toDraft(rubric))
  const queryClient = useQueryClient()
  const problems = validateDraft(draft)

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('save_rubric_version', toPayload(draft))
      if (error) throw error
      return data
    },
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: ['rubric'] })
      onDone(id)
    },
  })

  const updateDimension = (key: string, patch: Partial<DraftDimension>) =>
    setDraft((d) => ({ ...d, dimensions: d.dimensions.map((x) => (x.key === key ? { ...x, ...patch } : x)) }))

  const updateLevel = (dimKey: string, score: number, patch: Partial<DraftLevel>) =>
    setDraft((d) => ({
      ...d,
      dimensions: d.dimensions.map((x) =>
        x.key === dimKey ? { ...x, levels: x.levels.map((l) => (l.score === score ? { ...l, ...patch } : l)) } : x,
      ),
    }))

  const updateBand = (key: string, patch: Partial<DraftBand>) =>
    setDraft((d) => ({ ...d, bands: d.bands.map((b) => (b.key === key ? { ...b, ...patch } : b)) }))

  const num = (value: string) => (value === '' ? 0 : Number(value))

  return (
    <div className="space-y-6">
      {draft.dimensions.map((dimension, i) => (
        <Card key={dimension.key}>
          <CardHeader className="flex-row items-center gap-3">
            <span className="font-semibold">{String.fromCharCode(65 + i)}.</span>
            <Input
              aria-label="Dimension title"
              value={dimension.title}
              placeholder="Dimension title"
              onChange={(e) => updateDimension(dimension.key, { title: e.target.value })}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDraft((d) => ({ ...d, dimensions: d.dimensions.filter((x) => x.key !== dimension.key) }))}
            >
              Remove
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {dimension.levels.map((level) => (
              <div key={level.score} className="flex gap-3">
                <span className="w-6 shrink-0 pt-2 text-sm font-semibold">{level.score}</span>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <Input
                      aria-label={`Label for score ${level.score}`}
                      value={level.label}
                      placeholder="Label"
                      onChange={(e) => updateLevel(dimension.key, level.score, { label: e.target.value })}
                    />
                    <label className="flex shrink-0 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={level.is_auto_no_go}
                        onChange={(e) => updateLevel(dimension.key, level.score, { is_auto_no_go: e.target.checked })}
                      />
                      Auto no-go
                    </label>
                  </div>
                  <Textarea
                    aria-label={`Description for score ${level.score}`}
                    value={level.description}
                    placeholder="What earns this score"
                    onChange={(e) => updateLevel(dimension.key, level.score, { description: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      <Button
        variant="outline"
        onClick={() => setDraft((d) => ({ ...d, dimensions: [...d.dimensions, newDimension(d.scaleMax)] }))}
      >
        Add dimension
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Decision matrix (totals 0 to {maxTotal(draft)})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {draft.bands.map((band) => (
            <div key={band.key} className="space-y-2 rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label="Minimum total"
                  type="number"
                  className="w-20"
                  value={band.min_score}
                  onChange={(e) => updateBand(band.key, { min_score: num(e.target.value) })}
                />
                <span>to</span>
                <Input
                  aria-label="Maximum total"
                  type="number"
                  className="w-20"
                  value={band.max_score}
                  onChange={(e) => updateBand(band.key, { max_score: num(e.target.value) })}
                />
                <Input
                  aria-label="Band label"
                  className="min-w-40 flex-1"
                  value={band.label}
                  placeholder="Label"
                  onChange={(e) => updateBand(band.key, { label: e.target.value })}
                />
                <select
                  aria-label="Band tone"
                  className={selectClass}
                  value={band.tone}
                  onChange={(e) => updateBand(band.key, { tone: e.target.value as BandTone })}
                >
                  {BAND_TONES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDraft((d) => ({ ...d, bands: d.bands.filter((b) => b.key !== band.key) }))}
                >
                  Remove
                </Button>
              </div>
              <Textarea
                aria-label="Band action"
                value={band.action}
                placeholder="What the team should do"
                onChange={(e) => updateBand(band.key, { action: e.target.value })}
              />
            </div>
          ))}
          <Button variant="outline" onClick={() => setDraft((d) => ({ ...d, bands: [...d.bands, newBand()] }))}>
            Add band
          </Button>
        </CardContent>
      </Card>

      {problems.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {save.error && <p className="text-sm text-destructive">Could not save. Please try again.</p>}

      <div className="flex gap-3">
        <Button disabled={problems.length > 0 || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : `Save as version ${rubric.version + 1}`}
        </Button>
        <Button variant="ghost" onClick={() => onDone()}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
