-- Shared updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- RFPs
create table public.rfps (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  client_name text,
  status text not null default 'evaluating'
    check (status in ('evaluating', 'questions', 'proposal', 'submitted', 'won', 'lost', 'passed')),
  passed_from_status text
    check (passed_from_status in ('evaluating', 'questions', 'proposal')),
  source_url text,
  due_date date,
  budget_text text,
  summary text,
  outcome_notes text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rfps_status_idx on public.rfps (status);
create trigger rfps_set_updated_at before update on public.rfps
  for each row execute function public.set_updated_at();

-- Versioned rubric: a version is immutable history once scored against; edits create a new version.
create table public.rubrics (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique,
  is_active boolean not null default false,
  scale_max integer not null default 3,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index rubrics_one_active_idx on public.rubrics (is_active) where is_active;

create table public.rubric_dimensions (
  id uuid primary key default gen_random_uuid(),
  rubric_id uuid not null references public.rubrics (id) on delete cascade,
  position integer not null,
  title text not null,
  unique (rubric_id, position)
);

create table public.rubric_levels (
  id uuid primary key default gen_random_uuid(),
  dimension_id uuid not null references public.rubric_dimensions (id) on delete cascade,
  score integer not null check (score >= 0),
  label text not null,
  description text not null,
  is_auto_no_go boolean not null default false,
  unique (dimension_id, score)
);

create table public.rubric_decision_bands (
  id uuid primary key default gen_random_uuid(),
  rubric_id uuid not null references public.rubrics (id) on delete cascade,
  position integer not null,
  min_score integer not null,
  max_score integer not null,
  label text not null,
  action text not null,
  tone text not null check (tone in ('go', 'conditional', 'likely_no', 'no')),
  unique (rubric_id, position)
);

-- RLS: sign-up is domain-locked, so every authenticated user is a Fieldtrip team member.
alter table public.rfps enable row level security;
alter table public.rubrics enable row level security;
alter table public.rubric_dimensions enable row level security;
alter table public.rubric_levels enable row level security;
alter table public.rubric_decision_bands enable row level security;

create policy "Team can read rfps" on public.rfps for select to authenticated using (true);
create policy "Team can insert rfps" on public.rfps for insert to authenticated
  with check ((select auth.uid()) is not null);
create policy "Team can update rfps" on public.rfps for update to authenticated
  using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);

create policy "Team can read rubrics" on public.rubrics for select to authenticated using (true);
create policy "Team can write rubrics" on public.rubrics for all to authenticated
  using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy "Team can read dimensions" on public.rubric_dimensions for select to authenticated using (true);
create policy "Team can write dimensions" on public.rubric_dimensions for all to authenticated
  using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy "Team can read levels" on public.rubric_levels for select to authenticated using (true);
create policy "Team can write levels" on public.rubric_levels for all to authenticated
  using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy "Team can read bands" on public.rubric_decision_bands for select to authenticated using (true);
create policy "Team can write bands" on public.rubric_decision_bands for all to authenticated
  using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);

create index rubric_dimensions_rubric_idx on public.rubric_dimensions (rubric_id);
create index rubric_levels_dimension_idx on public.rubric_levels (dimension_id);
create index rubric_bands_rubric_idx on public.rubric_decision_bands (rubric_id);
create index rfps_created_by_idx on public.rfps (created_by);
create index rubrics_created_by_idx on public.rubrics (created_by);

-- Seed: Fieldtrip's go/no-go rubric, v1
do $$
declare
  r uuid;
  d uuid;
begin
  insert into public.rubrics (version, is_active, created_by) values (1, true, null) returning id into r;

  insert into public.rubric_dimensions (rubric_id, position, title)
    values (r, 1, 'Mission and Segment Alignment') returning id into d;
  insert into public.rubric_levels (dimension_id, score, label, description) values
    (d, 3, 'Excellent', 'Direct alignment with a core Fieldtrip segment. The mission is clear, and we can immediately see how to multiply it.'),
    (d, 2, 'Good', 'Adjacent segment or slightly vague mission, but highly positive social impact.'),
    (d, 1, 'Fair', 'Weak mission alignment or commercial client with a cause-marketing angle.'),
    (d, 0, 'Poor', 'No mission alignment or purely transactional commercial project.');

  insert into public.rubric_dimensions (rubric_id, position, title)
    values (r, 2, 'Budget and Value Health') returning id into d;
  insert into public.rubric_levels (dimension_id, score, label, description, is_auto_no_go) values
    (d, 3, 'Excellent', 'Budget is explicitly stated and matches the requested scope. Allows for healthy margins without cutting corners.', false),
    (d, 2, 'Good', 'Budget is unstated but historical data or client type suggests a healthy standard range for this scope.', false),
    (d, 1, 'Fair', 'Budget is low or tight, requiring scope compromises. High risk of over-functioning to deliver quality.', false),
    (d, 0, 'Poor / Auto No-Go', 'Unrealistic budget or free/spec work required in the proposal itself.', true);

  insert into public.rubric_dimensions (rubric_id, position, title)
    values (r, 3, 'Scope and Relationship Boundaries') returning id into d;
  insert into public.rubric_levels (dimension_id, score, label, description) values
    (d, 3, 'Excellent', 'Scope is tightly defined with clear deliverables. Client values strategic expertise. Fieldtrip has direct access to decision-makers.'),
    (d, 2, 'Good', 'Scope is mostly clear but has some open-ended elements. Access to decision-makers is limited to written Q&A.'),
    (d, 1, 'Fair', 'Vague scope that invites "do everything" expectations. No access to decision-makers.'),
    (d, 0, 'Poor', 'Extremely bloated scope designed to get maximum labor for minimum pay. Vague or shifting requirements.');

  insert into public.rubric_dimensions (rubric_id, position, title)
    values (r, 4, 'Timeline and Capacity Feasibility') returning id into d;
  insert into public.rubric_levels (dimension_id, score, label, description) values
    (d, 3, 'Excellent', 'Proposal deadline is at least 3 to 4 weeks away. Project timeline meets or exceeds the standard benchmark for the scope type.'),
    (d, 2, 'Good', 'Proposal deadline is tight (1 to 2 weeks) but we have relevant templates. Project timeline is 20 to 30 percent shorter than the benchmark.'),
    (d, 1, 'Fair', 'Proposal deadline requires significant effort to meet. Project timeline is 40 to 50 percent shorter than the benchmark.'),
    (d, 0, 'Poor', 'Project timeline is so compressed relative to scope that delivering quality work without burning out the team is not feasible.');

  insert into public.rubric_decision_bands (rubric_id, position, min_score, max_score, label, action, tone) values
    (r, 1, 10, 12, 'Definite Go', 'Proceed to proposal drafting. Highly aligned, profitable, and manageable.', 'go'),
    (r, 2, 7, 9, 'Conditional Go', 'Proceed only if we can negotiate scope, clarify the budget, or secure direct access.', 'conditional'),
    (r, 3, 4, 6, 'Likely No-Go', 'Decline unless there is a strong strategic reason, such as a foot-in-the-door with a massive long-term client.', 'likely_no'),
    (r, 4, 0, 3, 'Definite No-Go', 'Politely decline. Pursuing this trades team bandwidth for low-margin, high-stress work.', 'no');
end $$;
