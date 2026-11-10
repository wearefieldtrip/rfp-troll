-- The budget the RFP states, as dollars. Both null means the RFP does not state one.
--   single amount   -> min = max
--   a range         -> min < max
--   "up to $X"      -> min null, max X
--   "at least $X"   -> min X, max null
-- budget_qualifier is a short phrase ("all-inclusive", "plus media", "per year, 3 years");
-- budget_wording is a short quote from the RFP. budget_source says whether the app read it or a person typed it.
alter table public.rfps
  add column budget_min_usd bigint check (budget_min_usd >= 0),
  add column budget_max_usd bigint check (budget_max_usd >= 0),
  add column budget_qualifier text,
  add column budget_wording text,
  add column budget_source text check (budget_source in ('inferred', 'manual')),
  add constraint rfps_budget_range check (budget_min_usd is null or budget_max_usd is null or budget_min_usd <= budget_max_usd);
