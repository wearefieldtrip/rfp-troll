-- Details read out of the uploaded RFP by a small model. Existing rows default to 'done' so they are never overwritten.
alter table public.rfps
  add column extract_status text not null default 'done'
    check (extract_status in ('pending', 'done', 'failed')),
  add column extract_error text,
  add column due_date_source text check (due_date_source in ('manual', 'inferred')),
  add column due_date_evidence text,
  add column key_dates jsonb not null default '[]'::jsonb;
