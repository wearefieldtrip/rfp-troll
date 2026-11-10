// Looks at a PDF in the browser before it is uploaded: refuses a password-protected one and flags a scanned one.
// pdf.js is loaded on demand so it never weighs down the rest of the app.

export type PdfCheck = { ok: true; scanned: boolean } | { ok: false; reason: string }

const PAGES_TO_SAMPLE = 3
/** Fewer characters than this per sampled page reads as a picture of text, not text. */
const MIN_CHARS_PER_PAGE = 40

/** True when the sampled pages carry too little text to be a typed document. */
export const looksScanned = (charsPerPage: number[]) =>
  charsPerPage.length > 0 && charsPerPage.reduce((a, b) => a + b, 0) / charsPerPage.length < MIN_CHARS_PER_PAGE

export async function checkPdf(file: File): Promise<PdfCheck> {
  try {
    const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
    const doc = await task.promise
    try {
      const counts: number[] = []
      for (let n = 1; n <= Math.min(doc.numPages, PAGES_TO_SAMPLE); n++) {
        const page = await doc.getPage(n)
        const text = await page.getTextContent()
        counts.push(text.items.reduce((sum, item) => sum + ('str' in item ? item.str.trim().length : 0), 0))
      }
      return { ok: true, scanned: looksScanned(counts) }
    } finally {
      void task.destroy()
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'PasswordException') {
      return { ok: false, reason: `${file.name} is password protected. Remove the password and upload it again.` }
    }
    // Anything else (a PDF this reader can't parse, a blocked worker): let the upload go ahead and let the server decide.
    return { ok: true, scanned: false }
  }
}
