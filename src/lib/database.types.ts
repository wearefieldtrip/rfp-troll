// Trimmed from `generate_typescript_types`; regenerate when the schema changes.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { avatar_url: string | null; created_at: string; email: string; full_name: string | null; id: string }
        Insert: { avatar_url?: string | null; created_at?: string; email: string; full_name?: string | null; id: string }
        Update: { avatar_url?: string | null; created_at?: string; email?: string; full_name?: string | null; id?: string }
        Relationships: []
      }
      rfps: {
        Row: {
          budget_text: string | null
          budget_estimate: Json | null
          budget_max_usd: number | null
          budget_min_usd: number | null
          budget_qualifier: string | null
          budget_source: string | null
          budget_wording: string | null
          client_name: string | null
          closed_reason: string | null
          created_at: string
          created_by: string | null
          drive_error: string | null
          drive_folder_id: string | null
          drive_folder_url: string | null
          drive_rfp_subfolder_id: string | null
          drive_status: string
          due_date: string | null
          due_date_evidence: string | null
          due_date_source: string | null
          extract_error: string | null
          extract_status: string
          upload_note: string | null
          questions_doc_error: string | null
          questions_doc_id: string | null
          questions_doc_status: string | null
          questions_suggestions_status: string | null
          questions_bank_count: number | null
          questions_suggested_count: number | null
          questions_sent_on: string | null
          questions_sent_count: number | null
          questions_sent_pdf_id: string | null
          key_dates: Json
          id: string
          outcome_notes: string | null
          passed_at: string | null
          proposal_due_at: string | null
          proposal_due_has_time: boolean
          proposal_due_text: string | null
          proposal_due_tz: string | null
          questions_due_at: string | null
          questions_due_has_time: boolean
          questions_due_text: string | null
          questions_due_tz: string | null
          questions_policy: string
          vendor_selection_at: string | null
          vendor_selection_has_time: boolean
          vendor_selection_text: string | null
          vendor_selection_tz: string | null
          owner_id: string | null
          passed_from_status: string | null
          source_url: string | null
          status: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          budget_text?: string | null
          budget_estimate?: Json | null
          budget_max_usd?: number | null
          budget_min_usd?: number | null
          budget_qualifier?: string | null
          budget_source?: string | null
          budget_wording?: string | null
          client_name?: string | null
          closed_reason?: string | null
          created_at?: string
          created_by?: string | null
          drive_error?: string | null
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          drive_rfp_subfolder_id?: string | null
          drive_status?: string
          due_date?: string | null
          due_date_evidence?: string | null
          due_date_source?: string | null
          extract_error?: string | null
          extract_status?: string
          upload_note?: string | null
          questions_doc_error?: string | null
          questions_doc_id?: string | null
          questions_doc_status?: string | null
          questions_suggestions_status?: string | null
          questions_bank_count?: number | null
          questions_suggested_count?: number | null
          questions_sent_on?: string | null
          questions_sent_count?: number | null
          questions_sent_pdf_id?: string | null
          key_dates?: Json
          id?: string
          outcome_notes?: string | null
          passed_at?: string | null
          proposal_due_at?: string | null
          proposal_due_has_time?: boolean
          proposal_due_text?: string | null
          proposal_due_tz?: string | null
          questions_due_at?: string | null
          questions_due_has_time?: boolean
          questions_due_text?: string | null
          questions_due_tz?: string | null
          questions_policy?: string
          vendor_selection_at?: string | null
          vendor_selection_has_time?: boolean
          vendor_selection_text?: string | null
          vendor_selection_tz?: string | null
          owner_id?: string | null
          passed_from_status?: string | null
          source_url?: string | null
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['rfps']['Insert']>
        Relationships: []
      }
      rfp_decisions: {
        Row: {
          decided_at: string
          decided_by: string | null
          destination: string | null
          from_status: string
          id: string
          kind: string
          note: string | null
          reason: string | null
          review_id: string | null
          rfp_id: string
          score_band: string | null
          score_total: number | null
          to_status: string
        }
        Insert: {
          decided_at?: string
          decided_by?: string | null
          destination?: string | null
          from_status: string
          id?: string
          kind: string
          note?: string | null
          reason?: string | null
          review_id?: string | null
          rfp_id: string
          score_band?: string | null
          score_total?: number | null
          to_status: string
        }
        Update: Partial<Database['public']['Tables']['rfp_decisions']['Insert']>
        Relationships: [
          { foreignKeyName: 'rfp_decisions_rfp_id_fkey'; columns: ['rfp_id']; isOneToOne: false; referencedRelation: 'rfps'; referencedColumns: ['id'] },
          { foreignKeyName: 'rfp_decisions_decided_by_fkey'; columns: ['decided_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'rfp_decisions_review_id_fkey'; columns: ['review_id']; isOneToOne: false; referencedRelation: 'rfp_reviews'; referencedColumns: ['id'] },
        ]
      }
      rfp_documents: {
        Row: { created_at: string; drive_file_id: string | null; file_name: string; id: string; mime_type: string | null; rfp_id: string; size_bytes: number | null; storage_path: string; superseded_at: string | null; uploaded_by: string | null }
        Insert: { created_at?: string; drive_file_id?: string | null; file_name: string; id?: string; mime_type?: string | null; rfp_id: string; size_bytes?: number | null; storage_path: string; superseded_at?: string | null; uploaded_by?: string | null }
        Update: Partial<Database['public']['Tables']['rfp_documents']['Insert']>
        Relationships: [
          { foreignKeyName: 'rfp_documents_rfp_id_fkey'; columns: ['rfp_id']; isOneToOne: false; referencedRelation: 'rfps'; referencedColumns: ['id'] },
        ]
      }
      rfp_answers: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          drive_file_id: string | null
          error: string | null
          file_name: string | null
          id: string
          pasted_text: string | null
          received_on: string
          result: Json | null
          review_id: string | null
          rfp_id: string
          status: string
          storage_path: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          drive_file_id?: string | null
          error?: string | null
          file_name?: string | null
          id?: string
          pasted_text?: string | null
          received_on: string
          result?: Json | null
          review_id?: string | null
          rfp_id: string
          status?: string
          storage_path?: string | null
        }
        Update: Partial<Database['public']['Tables']['rfp_answers']['Insert']>
        Relationships: [
          { foreignKeyName: 'rfp_answers_rfp_id_fkey'; columns: ['rfp_id']; isOneToOne: false; referencedRelation: 'rfps'; referencedColumns: ['id'] },
          { foreignKeyName: 'rfp_answers_review_id_fkey'; columns: ['review_id']; isOneToOne: false; referencedRelation: 'rfp_reviews'; referencedColumns: ['id'] },
          { foreignKeyName: 'rfp_answers_created_by_fkey'; columns: ['created_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ]
      }
      rfp_reviews: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          decision_band: string | null
          error: string | null
          id: string
          model: string | null
          result: Json | null
          rfp_id: string
          rubric_id: string
          status: string
          total_score: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          decision_band?: string | null
          error?: string | null
          id?: string
          model?: string | null
          result?: Json | null
          rfp_id: string
          rubric_id: string
          status?: string
          total_score?: number | null
        }
        Update: Partial<Database['public']['Tables']['rfp_reviews']['Insert']>
        Relationships: [
          { foreignKeyName: 'rfp_reviews_rfp_id_fkey'; columns: ['rfp_id']; isOneToOne: false; referencedRelation: 'rfps'; referencedColumns: ['id'] },
          { foreignKeyName: 'rfp_reviews_rubric_id_fkey'; columns: ['rubric_id']; isOneToOne: false; referencedRelation: 'rubrics'; referencedColumns: ['id'] },
          { foreignKeyName: 'rfp_reviews_created_by_fkey'; columns: ['created_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ]
      }
      rubrics: {
        Row: { content: string; created_at: string; created_by: string | null; id: string; is_active: boolean; version: number }
        Insert: { content: string; created_at?: string; created_by?: string | null; id?: string; is_active?: boolean; version: number }
        Update: Partial<Database['public']['Tables']['rubrics']['Insert']>
        Relationships: [
          { foreignKeyName: 'rubrics_created_by_fkey'; columns: ['created_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      save_rubric_version: { Args: { p_content: string }; Returns: string }
      decide_rfp: {
        Args: { p_rfp_id: string; p_decision: string; p_destination?: string; p_reason?: string; p_note?: string; p_expected_status?: string }
        Returns: string
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
