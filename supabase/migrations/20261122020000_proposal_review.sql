-- Step 4 (docs/specs/step-4-review.md): the checklist pass over the proposal Doc.
alter table public.rfps
  add column proposal_review jsonb,
  add column proposal_review_status text check (proposal_review_status in ('building', 'ready', 'failed')),
  add column proposal_review_error text;
