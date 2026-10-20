-- Files attached to an RFP (the RFP itself, addenda, etc.). The bytes live in Storage; this row points at them.
create table public.rfp_documents (
  id uuid primary key default gen_random_uuid(),
  rfp_id uuid not null references public.rfps (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index rfp_documents_rfp_idx on public.rfp_documents (rfp_id);
create index rfp_documents_uploaded_by_idx on public.rfp_documents (uploaded_by);

alter table public.rfp_documents enable row level security;
create policy "Team can read rfp documents" on public.rfp_documents for select to authenticated using (true);
create policy "Team can insert rfp documents" on public.rfp_documents for insert to authenticated
  with check ((select auth.uid()) is not null);
create policy "Team can delete rfp documents" on public.rfp_documents for delete to authenticated
  using ((select auth.uid()) is not null);

-- Private bucket for the files themselves.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rfp-documents',
  'rfp-documents',
  false,
  52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown'
  ]
);

create policy "Team can read rfp files" on storage.objects for select to authenticated
  using (bucket_id = 'rfp-documents');
create policy "Team can upload rfp files" on storage.objects for insert to authenticated
  with check (bucket_id = 'rfp-documents');
create policy "Team can delete rfp files" on storage.objects for delete to authenticated
  using (bucket_id = 'rfp-documents');
