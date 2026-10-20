import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Markdown } from '@/components/Markdown'
import { MarkdownEditor } from '@/components/MarkdownEditor'
import { Button } from '@/components/ui/button'
import type { Rubric } from '@/lib/queries'
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

      {save.error && <p className="text-sm text-destructive">Could not save. Please try again.</p>}

      <div className="flex gap-3">
        <Button disabled={unchanged || empty || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : `Save as version ${rubric.version + 1}`}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
