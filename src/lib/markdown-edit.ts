/** Pure text transforms for the Markdown toolbar. Each returns the new text and the selection to restore. */
export type Edit = { value: string; start: number; end: number }

export function wrapSelection(value: string, start: number, end: number, before: string, after: string, placeholder: string): Edit {
  const selected = value.slice(start, end)
  // Toggle off when the selection is already wrapped.
  if (selected && selected.startsWith(before) && selected.endsWith(after) && selected.length >= before.length + after.length) {
    const inner = selected.slice(before.length, selected.length - after.length)
    return { value: value.slice(0, start) + inner + value.slice(end), start, end: start + inner.length }
  }
  const text = selected || placeholder
  const next = value.slice(0, start) + before + text + after + value.slice(end)
  return { value: next, start: start + before.length, end: start + before.length + text.length }
}

export function prefixLines(value: string, start: number, end: number, prefix: (index: number) => string, matches: RegExp): Edit {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const nextBreak = value.indexOf('\n', end)
  const lineEnd = nextBreak === -1 ? value.length : nextBreak
  const lines = value.slice(lineStart, lineEnd).split('\n')

  const allPrefixed = lines.every((l) => matches.test(l))
  const changed = lines
    .map((l, i) => (allPrefixed ? l.replace(matches, '') : prefix(i) + l.replace(matches, '')))
    .join('\n')

  return { value: value.slice(0, lineStart) + changed + value.slice(lineEnd), start: lineStart, end: lineStart + changed.length }
}

export function insertLink(value: string, start: number, end: number): Edit {
  const text = value.slice(start, end) || 'link text'
  const url = 'https://'
  const next = value.slice(0, start) + `[${text}](${url})` + value.slice(end)
  const urlStart = start + text.length + 3
  return { value: next, start: urlStart, end: urlStart + url.length }
}
