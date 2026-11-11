-- Step 2: the questions doc built from the template, and the record of sending it.
alter table public.rfps
  add column questions_doc_id text,
  add column questions_doc_status text check (questions_doc_status in ('building', 'ready', 'failed')),
  add column questions_doc_error text,
  -- The doc can be ready while the AI suggestions failed to save; they retry on their own.
  add column questions_suggestions_status text check (questions_suggestions_status in ('added', 'failed')),
  add column questions_bank_count integer,
  add column questions_suggested_count integer,
  add column questions_sent_on date,
  add column questions_sent_count integer,
  add column questions_sent_pdf_id text;
