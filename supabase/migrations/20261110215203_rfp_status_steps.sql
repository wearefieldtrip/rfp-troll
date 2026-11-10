-- Status is the step plus a word or two (docs/process-overview.md), replacing the seven one-word statuses.
alter table public.rfps drop constraint rfps_status_check;
alter table public.rfps drop constraint rfps_passed_from_status_check;

update public.rfps r set status = case r.status
  when 'evaluating' then case when exists (select 1 from public.rfp_reviews v where v.rfp_id = r.id and v.status = 'complete')
                              then 'evaluate_ready' else 'evaluate_reading' end
  when 'questions' then 'questions_drafting'
  when 'proposal' then 'proposal_drafting'
  when 'submitted' then 'submitted_waiting'
  when 'won' then 'closed_won'
  when 'lost' then 'closed_lost'
  when 'passed' then 'closed_passed'
  else r.status end;

update public.rfps set passed_from_status = case passed_from_status
  when 'evaluating' then 'evaluate_ready'
  when 'questions' then 'questions_drafting'
  when 'proposal' then 'proposal_drafting'
  else passed_from_status end
where passed_from_status is not null;

alter table public.rfps
  add constraint rfps_status_check check (status in (
    'evaluate_reading', 'evaluate_ready',
    'questions_drafting', 'questions_sent', 'questions_answers_in',
    'proposal_drafting', 'proposal_in_review',
    'submitted_waiting', 'submitted_shortlisted',
    'closed_won', 'closed_lost', 'closed_passed')),
  add constraint rfps_passed_from_status_check check (passed_from_status is null or passed_from_status in (
    'evaluate_ready', 'questions_drafting', 'questions_sent', 'questions_answers_in', 'proposal_drafting', 'proposal_in_review')),
  alter column status set default 'evaluate_reading';

-- A completed fit review is what makes an RFP ready for a decision.
create or replace function public.mark_ready_after_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'complete' and (tg_op = 'INSERT' or old.status is distinct from 'complete') then
    update public.rfps set status = 'evaluate_ready' where id = new.rfp_id and status = 'evaluate_reading';
  end if;
  return new;
end;
$$;

create trigger rfp_reviews_mark_ready
  after insert or update of status on public.rfp_reviews
  for each row execute function public.mark_ready_after_review();
