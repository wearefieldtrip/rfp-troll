import { checkPdf } from './pdf-check'
import { supabase } from './supabase'

const BUCKET = 'rfp-documents'

export const ACCEPTED_EXTENSIONS = ['.pdf', '.docx']
export const MAX_FILE_BYTES = 50 * 1024 * 1024
export const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(',')

const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

const extensionOf = (name: string) => name.slice(name.lastIndexOf('.')).toLowerCase()

export const isAcceptedFile = (file: File) => ACCEPTED_EXTENSIONS.includes(extensionOf(file.name))

/** Uploads files to Storage and records them against the RFP. Throws on the first failure. */
export async function uploadRfpFiles(rfpId: string, files: File[]) {
  for (const file of files) {
    const mimeType = MIME_BY_EXTENSION[extensionOf(file.name)]
    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_')
    const storagePath = `${rfpId}/${crypto.randomUUID()}-${safeName}`

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, { contentType: mimeType })
    if (uploadError) throw uploadError

    const { error: rowError } = await supabase.from('rfp_documents').insert({
      rfp_id: rfpId,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: mimeType,
      size_bytes: file.size,
    })
    if (rowError) {
      await supabase.storage.from(BUCKET).remove([storagePath])
      throw rowError
    }
  }
}

export type FileCheck = { ok: true; scanned: boolean } | { ok: false; reason: string }

/** Everything worth telling someone before an upload starts: type, size, a password, a scan. */
export async function checkRfpFile(file: File): Promise<FileCheck> {
  if (!isAcceptedFile(file)) return { ok: false, reason: `${file.name} isn't a PDF or Word (.docx) file.` }
  if (file.size === 0) return { ok: false, reason: `${file.name} is empty.` }
  if (file.size > MAX_FILE_BYTES) return { ok: false, reason: `${file.name} is over 50 MB.` }
  if (extensionOf(file.name) === '.pdf') return await checkPdf(file)
  return { ok: true, scanned: false }
}
