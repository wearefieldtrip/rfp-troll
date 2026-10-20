import { supabase } from './supabase'

const BUCKET = 'rfp-documents'

export const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md']
export const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(',')

const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
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
