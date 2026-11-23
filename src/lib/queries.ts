import { queryOptions } from '@tanstack/react-query'
import { supabase } from './supabase'

export const rfpsQuery = queryOptions({
  queryKey: ['rfps'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('rfps')
      .select('*, rfp_reviews(status, total_score, decision_band, created_at)')
      .order('created_at', { ascending: false })
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
    // Keep checking while the Drive folder, the questions doc, the requirements or the proposal doc are being set up in the background.
    refetchInterval: (query) => {
      const d = query.state.data
      const busy = d?.drive_status === 'syncing' || d?.questions_doc_status === 'building' || d?.proposal_draft_status === 'building' || d?.requirements_status === 'building'
      return busy ? 2500 : false
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

export const rfpDecisionsQuery = (rfpId: string) =>
  queryOptions({
    queryKey: ['rfps', rfpId, 'decisions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rfp_decisions')
        .select('*, profiles(full_name, email)')
        .eq('rfp_id', rfpId)
        .order('decided_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

// A new RFP's first review starts on its own a few seconds after the upload, so keep checking for it for a while.
const FIRST_REVIEW_WAIT_MS = 10 * 60 * 1000

export const rfpReviewsQuery = (rfpId: string, rfpCreatedAt?: string) =>
  queryOptions({
    queryKey: ['rfps', rfpId, 'reviews'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rfp_reviews')
        .select('*, rubrics(version), profiles(full_name, email)')
        .eq('rfp_id', rfpId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    // Keep checking while a review is running in the background.
    refetchInterval: (query) => {
      const reviews = query.state.data
      if (reviews?.some((r) => r.status === 'running')) return 3000
      const waitingForFirst = !!rfpCreatedAt && reviews?.length === 0 && Date.now() - new Date(rfpCreatedAt).getTime() < FIRST_REVIEW_WAIT_MS
      return waitingForFirst ? 3000 : false
    },
  })

/** Batches of the issuer's answers, newest first. Checks again while one is being read. */
export const rfpAnswersQuery = (rfpId: string) =>
  queryOptions({
    queryKey: ['rfps', rfpId, 'answers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('rfp_answers').select('*').eq('rfp_id', rfpId).order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    refetchInterval: (query) => (query.state.data?.some((a) => a.status === 'reading') ? 3000 : false),
  })

export const teamQuery = queryOptions({
  queryKey: ['team'],
  queryFn: async () => {
    const { data, error } = await supabase.from('profiles').select('id, full_name, email').order('full_name')
    if (error) throw error
    return data
  },
})

export const tagValuesQuery = queryOptions({
  queryKey: ['tags', 'values'],
  queryFn: async () => {
    const { data, error } = await supabase.from('tag_values').select('*')
    if (error) throw error
    return data
  },
})

/** Which tag values are used by how many RFPs, so a value that is in use is never removed. */
export const tagUsageQuery = queryOptions({
  queryKey: ['tags', 'usage'],
  queryFn: async () => {
    const { data, error } = await supabase.from('rfp_tags').select('tag_value_id')
    if (error) throw error
    const counts = new Map<string, number>()
    for (const row of data) counts.set(row.tag_value_id, (counts.get(row.tag_value_id) ?? 0) + 1)
    return counts
  },
})

/** The tags one RFP carries, with the group and value of each. */
export const rfpTagsQuery = (rfpId: string) =>
  queryOptions({
    queryKey: ['rfps', rfpId, 'tags'],
    queryFn: async () => {
      const { data, error } = await supabase.from('rfp_tags').select('id, tag_value_id, source, confirmed, tag_values(tag_group, value)').eq('rfp_id', rfpId)
      if (error) throw error
      return data
    },
  })

/** The past RFPs a person picked as similar to this one, oldest pick first. */
export const rfpSimilarQuery = (rfpId: string) =>
  queryOptions({
    queryKey: ['rfps', rfpId, 'similar'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rfp_similar')
        .select('id, similar_rfp_id, created_at, profiles(full_name, email)')
        .eq('rfp_id', rfpId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
  })

/** Every RFP that has finished (won or lost), with its tags, for finding the ones most like another. */
export const pastRfpsQuery = queryOptions({
  queryKey: ['rfps', 'past'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('rfps')
      .select('id, client_name, title, status, outcome, furthest_stage, submission_year, created_at, proposal_doc_id, rfp_tags(tag_values(tag_group, value))')
      .in('status', ['closed_won', 'closed_lost'])
    if (error) throw error
    return data
  },
})
