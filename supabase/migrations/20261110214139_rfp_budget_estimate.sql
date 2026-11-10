-- A rough budget estimate sized from the issuer's latest full Form 990 (ProPublica Nonprofit Explorer), only when the RFP
-- states no budget. One of:
--   { "status": "estimated", "low": 65000, "high": 200000, "ein": "131427696", "org_name": "...", "state": "NY",
--     "tax_year": 2023, "total_expenses": 22169639, "rule": "..." }
--   { "status": "unavailable", "reason": "no_match" | "ambiguous" | "government" | "not_full_990" | "no_filings" | "lookup_failed" }
-- Null means no lookup was made (for example, the RFP states a budget, or the RFP was read before this existed).
alter table public.rfps add column budget_estimate jsonb;
