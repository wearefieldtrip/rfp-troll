-- When an RFP was passed on, for sorting and history.
alter table public.rfps add column passed_at timestamptz;
