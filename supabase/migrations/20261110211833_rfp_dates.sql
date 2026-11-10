-- The three dates the spec cares about, each stored as a moment in time plus the RFP's own wording.
--   *_at        the instant (timestamptz)
--   *_has_time  false when the RFP gave only a day. The instant is then that day at 12:00 UTC and only the day is shown.
--   *_tz        an IANA zone such as America/New_York, or null when the RFP gave a time without a zone.
--               The instant is then the wall-clock time read as UTC, and the app shows "time zone not stated".
--   *_text      a short verbatim quote from the RFP.
-- questions_policy keeps "Not allowed" and "Not stated" apart: due | not_allowed | not_stated.
alter table public.rfps
  add column proposal_due_at timestamptz,
  add column proposal_due_has_time boolean not null default false,
  add column proposal_due_tz text,
  add column proposal_due_text text,
  add column questions_policy text not null default 'not_stated' check (questions_policy in ('due', 'not_allowed', 'not_stated')),
  add column questions_due_at timestamptz,
  add column questions_due_has_time boolean not null default false,
  add column questions_due_tz text,
  add column questions_due_text text,
  add column vendor_selection_at timestamptz,
  add column vendor_selection_has_time boolean not null default false,
  add column vendor_selection_tz text,
  add column vendor_selection_text text;

-- Carry over what is already stored (days only; times and zones were not kept as data before).
update public.rfps
set proposal_due_at = (due_date::timestamp + interval '12 hours') at time zone 'UTC',
    proposal_due_text = due_date_evidence
where due_date is not null;

update public.rfps r
set questions_policy = 'due',
    questions_due_at = (k.day::timestamp + interval '12 hours') at time zone 'UTC',
    questions_due_text = k.evidence
from (
  select r2.id, e ->> 'date' as day, e ->> 'evidence' as evidence
  from public.rfps r2, jsonb_array_elements(r2.key_dates) e
  where e ->> 'label' ilike 'questions due%' and coalesce(e ->> 'date', '') <> ''
) k
where r.id = k.id;

update public.rfps r
set questions_policy = 'not_allowed',
    questions_due_text = k.evidence
from (
  select r2.id, e ->> 'evidence' as evidence
  from public.rfps r2, jsonb_array_elements(r2.key_dates) e
  where e ->> 'label' ilike 'questions due%' and coalesce(e ->> 'date', '') = ''
    and (e ->> 'evidence' ilike '%no questions%' or e ->> 'evidence' ilike '%not be accepted%')
) k
where r.id = k.id and r.questions_policy = 'not_stated';

update public.rfps r
set vendor_selection_at = (k.day::timestamp + interval '12 hours') at time zone 'UTC',
    vendor_selection_text = k.evidence
from (
  select r2.id, e ->> 'date' as day, e ->> 'evidence' as evidence
  from public.rfps r2, jsonb_array_elements(r2.key_dates) e
  where (e ->> 'label' ilike '%award%' or e ->> 'label' ilike '%selection%') and coalesce(e ->> 'date', '') <> ''
) k
where r.id = k.id;
