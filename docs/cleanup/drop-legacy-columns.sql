-- Run once in the Supabase SQL editor. Not applied automatically because it deletes data.
--
-- These four columns are no longer read or written by the app or any function:
--   due_date, due_date_evidence  replaced by proposal_due_at / _has_time / _tz / _text
--   key_dates                    the old list of every date in the RFP (the app tracks three dates now)
--   budget_text                  replaced by budget_min_usd / budget_max_usd / budget_qualifier / budget_wording
-- Checked on 2026-11-10: every row with a due_date or budget_text already has the replacement values.
-- Only the two TEST rows still hold old key_dates and evidence quotes, which will be lost.
--
-- Kept on purpose: due_date_source (inferred or manual proposal date) and drive_rfp_subfolder_id (RFPs made
-- before client folders were shared still have their own RFP subfolder).

alter table public.rfps drop column if exists due_date;
alter table public.rfps drop column if exists due_date_evidence;
alter table public.rfps drop column if exists key_dates;
alter table public.rfps drop column if exists budget_text;
