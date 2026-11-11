// Small helpers for showing the questions step.

/** Today as the value of a date input (YYYY-MM-DD), in the browser's own time zone. */
export function todayInputValue(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** A calendar day (YYYY-MM-DD) written out, such as "Nov 11, 2026". No time zone shift. */
export function formatDay(day: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', dateStyle: 'medium' }).format(new Date(`${day}T12:00:00Z`))
}

export const docUrl = (docId: string) => `https://docs.google.com/document/d/${docId}/edit`
export const fileUrl = (fileId: string) => `https://drive.google.com/file/d/${fileId}/view`

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** What the doc holds, such as "11 template questions and 8 AI suggested questions". */
export function docContents(bank: number | null, suggested: number | null): string {
  const parts = [plural(bank ?? 0, 'template question')]
  if (suggested) parts.push(`${suggested} AI suggested ${suggested === 1 ? 'question' : 'questions'}`)
  return parts.join(' and ')
}
