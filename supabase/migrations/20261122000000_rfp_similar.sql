-- Past RFPs a person has picked as similar to an RFP (docs/specs/tagging.md, "Picked by hand").
-- Never touched by tagging or re-reviews. A picked RFP with a proposal Doc is the default base proposal in step 3.
create table public.rfp_similar (
  id uuid primary key default gen_random_uuid(),
  rfp_id uuid not null references public.rfps (id) on delete cascade,
  similar_rfp_id uuid not null references public.rfps (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (rfp_id, similar_rfp_id),
  check (rfp_id <> similar_rfp_id)
);
create index rfp_similar_similar_idx on public.rfp_similar (similar_rfp_id);
create index rfp_similar_created_by_idx on public.rfp_similar (created_by);

alter table public.rfp_similar enable row level security;
create policy "Team can read similar picks" on public.rfp_similar for select to authenticated using (true);
create policy "Team can add similar picks" on public.rfp_similar for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "Team can remove similar picks" on public.rfp_similar for delete to authenticated
  using ((select auth.uid()) is not null);
