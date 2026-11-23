-- Step 3 (docs/specs/step-3-proposal.md): the requirements list and the proposal Doc built from a base proposal.
alter table public.rfps
  -- What the RFP asks the proposal to contain (see src/lib/requirements.ts for the shape). Step 4 checks against it.
  add column requirements jsonb,
  add column requirements_status text check (requirements_status in ('building', 'ready', 'failed')),
  add column requirements_error text,
  -- The proposal Doc the app made for this RFP, and the past RFP it was based on.
  add column proposal_draft_doc_id text,
  add column proposal_draft_status text check (proposal_draft_status in ('building', 'ready', 'failed')),
  add column proposal_draft_error text,
  add column proposal_base_rfp_id uuid references public.rfps (id) on delete set null,
  -- What the build did: sections kept, added, removed, and what to check.
  add column proposal_draft_summary jsonb;
create index rfps_proposal_base_idx on public.rfps (proposal_base_rfp_id);
