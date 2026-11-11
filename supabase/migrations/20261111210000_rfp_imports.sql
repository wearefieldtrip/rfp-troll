-- Past RFPs imported from the tracker (docs/specs/historical-data.md, Phase A).
alter table public.rfps
  add column source text not null default 'app' check (source in ('app', 'tracker', 'archive')),
  -- Won, lost and the rest, as the tracker says. Status stays Closed · Won or Closed · Lost.
  add column outcome text check (outcome in ('won', 'lost', 'no_response', 'qualified', 'unknown')),
  add column furthest_stage text check (furthest_stage in ('submitted', 'finalist', 'pitched')),
  add column submission_year integer,
  -- A stable key for each tracker row, so running the import again never makes a second copy.
  add column import_key text,
  add column import_batch_id uuid,
  -- A person has looked at this import and confirmed it; a re-run leaves it alone.
  add column import_reviewed boolean not null default false,
  -- Values the import could not map, for the Review imports screen.
  add column import_issues jsonb not null default '[]'::jsonb,
  -- The tracker row as it was read: section columns, case studies, who prepared it, the proposal link.
  add column import_data jsonb;

create unique index rfps_import_key_idx on public.rfps (import_key) where import_key is not null;
create index rfps_import_batch_idx on public.rfps (import_batch_id) where import_batch_id is not null;
