alter table public.rfps add column if not exists upload_note text;
comment on column public.rfps.upload_note is 'A note about the uploaded file, such as "Scanned document: double-check dates and figures".';
