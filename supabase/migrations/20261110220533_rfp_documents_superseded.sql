alter table public.rfp_documents add column if not exists superseded_at timestamptz;
comment on column public.rfp_documents.superseded_at is 'Set when the team replaces the RFP file. The next Drive sync trashes the old file and removes the row.';
