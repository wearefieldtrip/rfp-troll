-- When the AI last tagged a past RFP from its proposal Doc (docs/specs/tagging.md, Backfill).
alter table public.rfps add column ai_tagged_at timestamptz;
