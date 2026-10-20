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
          client_name: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          outcome_notes: string | null
          passed_from_status: string | null
          source_url: string | null
          status: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          budget_text?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          outcome_notes?: string | null
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
      rubrics: {
        Row: { created_at: string; created_by: string | null; id: string; is_active: boolean; scale_max: number; version: number }
        Insert: { created_at?: string; created_by?: string | null; id?: string; is_active?: boolean; scale_max?: number; version: number }
        Update: Partial<Database['public']['Tables']['rubrics']['Insert']>
        Relationships: [
          { foreignKeyName: 'rubrics_created_by_fkey'; columns: ['created_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ]
      }
      rubric_dimensions: {
        Row: { id: string; position: number; rubric_id: string; title: string }
        Insert: { id?: string; position: number; rubric_id: string; title: string }
        Update: Partial<Database['public']['Tables']['rubric_dimensions']['Insert']>
        Relationships: [
          { foreignKeyName: 'rubric_dimensions_rubric_id_fkey'; columns: ['rubric_id']; isOneToOne: false; referencedRelation: 'rubrics'; referencedColumns: ['id'] },
        ]
      }
      rubric_levels: {
        Row: { description: string; dimension_id: string; id: string; is_auto_no_go: boolean; label: string; score: number }
        Insert: { description: string; dimension_id: string; id?: string; is_auto_no_go?: boolean; label: string; score: number }
        Update: Partial<Database['public']['Tables']['rubric_levels']['Insert']>
        Relationships: [
          { foreignKeyName: 'rubric_levels_dimension_id_fkey'; columns: ['dimension_id']; isOneToOne: false; referencedRelation: 'rubric_dimensions'; referencedColumns: ['id'] },
        ]
      }
      rubric_decision_bands: {
        Row: { action: string; id: string; label: string; max_score: number; min_score: number; position: number; rubric_id: string; tone: string }
        Insert: { action: string; id?: string; label: string; max_score: number; min_score: number; position: number; rubric_id: string; tone: string }
        Update: Partial<Database['public']['Tables']['rubric_decision_bands']['Insert']>
        Relationships: [
          { foreignKeyName: 'rubric_decision_bands_rubric_id_fkey'; columns: ['rubric_id']; isOneToOne: false; referencedRelation: 'rubrics'; referencedColumns: ['id'] },
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      save_rubric_version: { Args: { p_dimensions: Json; p_bands: Json }; Returns: string }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
