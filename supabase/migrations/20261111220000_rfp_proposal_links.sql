-- The past proposal behind an imported RFP (docs/specs/historical-data.md, Phase A step 2).
alter table public.rfps
  add column proposal_doc_id text,
  add column proposal_pdf_id text,
  add column proposal_doc_name text,
  -- linked: the Google Doc opens. no_access: the service account can't open the link. not_a_doc: it opens but is not a Google Doc.
  add column proposal_link_status text check (proposal_link_status in ('linked', 'no_access', 'not_a_doc', 'no_link')),
  add column proposal_link_checked_at timestamptz,
  -- A link a person set by hand is never replaced by a re-check.
  add column proposal_link_source text check (proposal_link_source in ('import', 'person'));
