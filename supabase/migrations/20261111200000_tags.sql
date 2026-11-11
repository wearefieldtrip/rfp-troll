-- Tags (docs/specs/tagging.md): fixed lists kept in the Library, and the tags each RFP carries.
create table public.tag_values (
  id uuid primary key default gen_random_uuid(),
  tag_group text not null check (tag_group in (
    'client_type', 'sector', 'services', 'topics', 'audiences', 'budget_band', 'geography', 'procurement', 'requirements')),
  value text not null check (btrim(value) <> ''),
  -- The AI may suggest a value; it only joins the list when a person approves it.
  status text not null default 'approved' check (status in ('approved', 'suggested')),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
-- The same value in a group can't be added twice, however it is capitalized.
create unique index tag_values_group_value_idx on public.tag_values (tag_group, lower(value));
create index tag_values_created_by_idx on public.tag_values (created_by);

create table public.rfp_tags (
  id uuid primary key default gen_random_uuid(),
  rfp_id uuid not null references public.rfps (id) on delete cascade,
  tag_value_id uuid not null references public.tag_values (id) on delete cascade,
  source text not null check (source in ('ai', 'person', 'import')),
  confirmed boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (rfp_id, tag_value_id)
);
create index rfp_tags_tag_value_idx on public.rfp_tags (tag_value_id);
create index rfp_tags_updated_by_idx on public.rfp_tags (updated_by);

alter table public.tag_values enable row level security;
create policy "Team can read tag values" on public.tag_values for select to authenticated using (true);
create policy "Team can add tag values" on public.tag_values for insert to authenticated
  with check ((select auth.uid()) is not null);
create policy "Team can update tag values" on public.tag_values for update to authenticated
  using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
-- A value that is in use can't be removed from under the RFPs that carry it (the foreign key cascades, so only unused
-- values or rejected suggestions are deleted from the app).
create policy "Team can delete tag values" on public.tag_values for delete to authenticated
  using ((select auth.uid()) is not null);

alter table public.rfp_tags enable row level security;
create policy "Team can read rfp tags" on public.rfp_tags for select to authenticated using (true);
create policy "Team can add rfp tags" on public.rfp_tags for insert to authenticated
  with check ((select auth.uid()) is not null);
create policy "Team can update rfp tags" on public.rfp_tags for update to authenticated
  using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy "Team can remove rfp tags" on public.rfp_tags for delete to authenticated
  using ((select auth.uid()) is not null);

-- The starting lists.
insert into public.tag_values (tag_group, value, created_by) values
  ('client_type', 'Nonprofit', null), ('client_type', 'Civic / government', null), ('client_type', 'Education', null),

  ('sector', 'K-12', null), ('sector', 'Higher ed', null), ('sector', 'Transit', null), ('sector', 'Parks & rec', null),
  ('sector', 'Environmental / solid waste', null), ('sector', 'Health', null), ('sector', 'Youth & family', null),
  ('sector', 'Housing', null), ('sector', 'Arts & culture', null), ('sector', 'Tourism', null), ('sector', 'Research', null),
  ('sector', 'Foundation', null), ('sector', 'State agency', null),

  ('services', 'Brand strategy', null), ('services', 'Visual identity', null), ('services', 'Website', null),
  ('services', 'Campaign', null), ('services', 'Media planning & buying', null), ('services', 'Content & copy', null),
  ('services', 'Research & discovery', null), ('services', 'Social', null), ('services', 'Video & photo', null),
  ('services', 'Signage & wayfinding', null), ('services', 'Print & reports', null), ('services', 'Community outreach', null),
  ('services', 'Translation', null), ('services', 'Accessibility', null), ('services', 'Training', null),
  ('services', 'Ongoing support', null), ('services', 'Agency of record', null),

  ('topics', 'youth mental health', null), ('topics', 'recycling', null), ('topics', 'ridership', null),
  ('topics', 'stormwater', null), ('topics', 'fundraising', null), ('topics', 'recruitment', null),

  ('audiences', 'Youth', null), ('audiences', 'Parents & families', null), ('audiences', 'Donors', null),
  ('audiences', 'Residents', null), ('audiences', 'Riders', null), ('audiences', 'Students', null),
  ('audiences', 'Spanish speakers', null), ('audiences', 'Employees', null),

  ('budget_band', 'Under $50K', null), ('budget_band', '$50–100K', null), ('budget_band', '$100–250K', null),
  ('budget_band', '$250K+', null), ('budget_band', 'Not stated', null),

  -- States are added as they appear (they are filled in from the RFP, not picked from a list).
  ('geography', 'Louisville/KY', null), ('geography', 'Out of state', null),

  ('procurement', 'RFP', null), ('procurement', 'RFI', null), ('procurement', 'RFQ', null),
  ('procurement', 'Public', null), ('procurement', 'Private', null), ('procurement', 'Multi-year', null),
  ('procurement', 'Agency of record', null), ('procurement', 'Pitch round', null), ('procurement', 'DBE/WBE preference', null),

  ('requirements', 'Bilingual', null), ('requirements', 'WCAG compliance', null), ('requirements', 'Media buy pass-through', null),
  ('requirements', 'Subcontractors allowed', null), ('requirements', 'Spec work requested', null),
  ('requirements', 'Insurance minimums', null);
