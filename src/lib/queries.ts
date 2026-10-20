import { queryOptions } from '@tanstack/react-query'
import { supabase } from './supabase'

export const rfpsQuery = queryOptions({
  queryKey: ['rfps'],
  queryFn: async () => {
    const { data, error } = await supabase.from('rfps').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return data
  },
})

export const rfpQuery = (id: string) =>
  queryOptions({
    queryKey: ['rfps', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('rfps').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
  })

export const rfpDocumentsQuery = (rfpId: string) =>
  queryOptions({
    queryKey: ['rfps', rfpId, 'documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rfp_documents')
        .select('*')
        .eq('rfp_id', rfpId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
  })

export const rubricVersionsQuery = queryOptions({
  queryKey: ['rubric', 'versions'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('rubrics')
      .select('id, version, is_active, created_at, profiles(full_name, email)')
      .order('version', { ascending: false })
    if (error) throw error
    return data
  },
})

async function fetchRubric(id?: string) {
  const query = supabase.from('rubrics').select('*')
  const { data, error } = await (id ? query.eq('id', id) : query.eq('is_active', true)).single()
  if (error) throw error
  return data
}

export type Rubric = Awaited<ReturnType<typeof fetchRubric>>

/** A specific rubric version, or the active one when no id is given. */
export const rubricQuery = (id?: string) =>
  queryOptions({
    queryKey: ['rubric', id ?? 'active'],
    queryFn: () => fetchRubric(id),
  })
