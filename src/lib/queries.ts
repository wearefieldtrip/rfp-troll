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

export const activeRubricQuery = queryOptions({
  queryKey: ['rubric', 'active'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('rubrics')
      .select('*, rubric_dimensions(*, rubric_levels(*)), rubric_decision_bands(*)')
      .eq('is_active', true)
      .single()
    if (error) throw error
    return {
      ...data,
      rubric_dimensions: [...data.rubric_dimensions]
        .sort((a, b) => a.position - b.position)
        .map((d) => ({ ...d, rubric_levels: [...d.rubric_levels].sort((a, b) => b.score - a.score) })),
      rubric_decision_bands: [...data.rubric_decision_bands].sort((a, b) => a.position - b.position),
    }
  },
})
