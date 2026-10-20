import {
  BoldIcon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  type LucideIcon,
} from 'lucide-react'
import { useRef, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { insertLink, prefixLines, wrapSelection, type Edit } from '@/lib/markdown-edit'

type Props = {
  value: string
  onChange: (value: string) => void
  label: string
}

export function MarkdownEditor({ value, onChange, label }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const run = (transform: (start: number, end: number) => Edit) => {
    const el = ref.current
    if (!el) return
    const edit = transform(el.selectionStart, el.selectionEnd)
    onChange(edit.value)
    // Restore focus and selection once React has rendered the new value.
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(edit.start, edit.end)
    })
  }

  const bold = () => run((s, e) => wrapSelection(value, s, e, '**', '**', 'bold text'))
  const italic = () => run((s, e) => wrapSelection(value, s, e, '_', '_', 'italic text'))
  const heading = (level: 2 | 3) =>
    run((s, e) => prefixLines(value, s, e, () => `${'#'.repeat(level)} `, new RegExp(`^#{${level}} `)))
  const bullets = () => run((s, e) => prefixLines(value, s, e, () => '- ', /^- /))
  const numbered = () => run((s, e) => prefixLines(value, s, e, (i) => `${i + 1}. `, /^\d+\. /))
  const link = () => run((s, e) => insertLink(value, s, e))

  const actions: { label: string; icon: LucideIcon; onClick: () => void }[] = [
    { label: 'Heading', icon: Heading2Icon, onClick: () => heading(2) },
    { label: 'Subheading', icon: Heading3Icon, onClick: () => heading(3) },
    { label: 'Bold (⌘B)', icon: BoldIcon, onClick: bold },
    { label: 'Italic (⌘I)', icon: ItalicIcon, onClick: italic },
    { label: 'Bulleted list', icon: ListIcon, onClick: bullets },
    { label: 'Numbered list', icon: ListOrderedIcon, onClick: numbered },
    { label: 'Link', icon: LinkIcon, onClick: link },
  ]

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.metaKey || e.ctrlKey)) return
    if (e.key === 'b') {
      e.preventDefault()
      bold()
    } else if (e.key === 'i') {
      e.preventDefault()
      italic()
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
        {actions.map(({ label: title, icon: Icon, onClick }) => (
          <Button key={title} type="button" variant="ghost" size="icon-sm" title={title} aria-label={title} onClick={onClick}>
            <Icon />
          </Button>
        ))}
      </div>
      <Textarea
        ref={ref}
        aria-label={label}
        className="min-h-[32rem] font-mono text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
    </div>
  )
}
