import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Markdown } from '@/components/Markdown'
import { MarkdownEditor } from '@/components/MarkdownEditor'
import { Button } from '@/components/ui/button'
import type { Rubric } from '@/lib/queries'
import { checkRubric } from '@/lib/rubric-structure'
import { supabase } from '@/lib/supabase'

export function RubricEditor({ rubric, onDone }: { rubric: Rubric; onDone: () => void }) {
  const [content, setContent] = useState(rubric.content)
  const [preview, setPreview] = useState(false)
  const queryClient = useQueryClient()

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('save_rubric_version', { p_content: content })
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['rubric'] })
      onDone()
    },
  })

  const unchanged = content === rubric.content
  const empty = content.trim() === ''
  // The review reads the dimensions and bands from this text, so a version that breaks them can't be saved.
  const problems = useMemo(() => (empty ? [] : checkRubric(content).problems), [content, empty])

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant={preview ? 'outline' : 'secondary'} size="sm" onClick={() => setPreview(false)}>
          Write
        </Button>
        <Button variant={preview ? 'secondary' : 'outline'} size="sm" onClick={() => setPreview(true)}>
          Preview
        </Button>
      </div>

      {preview ? (
        <Markdown>{content}</Markdown>
      ) : (
        <MarkdownEditor label="Rubric text" value={content} onChange={setContent} />
      )}

      {problems.length > 0 && (
        <div role="alert" className="space-y-1 rounded-lg border border-destructive/40 px-4 py-3 text-sm">
          <p className="font-medium text-destructive">This version can't be saved yet:</p>
          <ul className="list-disc pl-5 text-destructive">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      {save.error && <p className="text-sm text-destructive">Could not save. Please try again.</p>}

      <div className="flex gap-3">
        <Button disabled={unchanged || empty || problems.length > 0 || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : `Save as version ${rubric.version + 1}`}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
