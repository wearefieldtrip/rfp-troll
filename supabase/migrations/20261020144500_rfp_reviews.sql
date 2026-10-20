-- One row per fit review run. The Edge Function creates it as 'running', then fills in the result.
create table public.rfp_reviews (
  id uuid primary key default gen_random_uuid(),
  rfp_id uuid not null references public.rfps (id) on delete cascade,
  rubric_id uuid not null references public.rubrics (id),
  status text not null default 'running' check (status in ('running', 'complete', 'failed')),
  model text,
  result jsonb,
  total_score integer,
  decision_band text,
  error text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index rfp_reviews_rfp_idx on public.rfp_reviews (rfp_id, created_at desc);
create index rfp_reviews_rubric_idx on public.rfp_reviews (rubric_id);
create index rfp_reviews_created_by_idx on public.rfp_reviews (created_by);

alter table public.rfp_reviews enable row level security;
create policy "Team can read reviews" on public.rfp_reviews for select to authenticated using (true);
create policy "Team can start reviews" on public.rfp_reviews for insert to authenticated
  with check (created_by = (select auth.uid()));
-- The function updates the row as the user who started the review.
create policy "Starter can update their review" on public.rfp_reviews for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
