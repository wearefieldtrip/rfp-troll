-- The hand-offs after the proposal is built: ready for review, back to drafting, submitted, shortlisted, won, lost.
-- Each is recorded in the decision history, like move forward and pass.
alter table public.rfp_decisions drop constraint rfp_decisions_kind_check;
alter table public.rfp_decisions add constraint rfp_decisions_kind_check
  check (kind in ('move_forward', 'pass', 'reopen', 'ready_for_review', 'back_to_drafting', 'submitted', 'shortlisted', 'won', 'lost'));

create or replace function public.advance_rfp(
  p_rfp_id uuid,
  p_action text,
  p_expected_status text default null,
  p_note text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  r public.rfps%rowtype;
  new_status text;
  decision_id uuid;
  clean_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into r from public.rfps where id = p_rfp_id for update;
  if not found then raise exception 'RFP not found'; end if;
  if p_expected_status is not null and r.status <> p_expected_status then
    raise exception 'This RFP changed while you were looking at it. Reload and try again.';
  end if;

  if p_action = 'ready_for_review' then
    if r.status <> 'proposal_drafting' then raise exception 'This RFP is not in Proposal · Drafting.'; end if;
    new_status := 'proposal_in_review';
  elsif p_action = 'back_to_drafting' then
    if r.status <> 'proposal_in_review' then raise exception 'This RFP is not in Proposal · In review.'; end if;
    new_status := 'proposal_drafting';
  elsif p_action = 'submitted' then
    if r.status not in ('proposal_drafting', 'proposal_in_review') then raise exception 'Only a proposal being worked on can be marked as submitted.'; end if;
    new_status := 'submitted_waiting';
  elsif p_action = 'shortlisted' then
    if r.status <> 'submitted_waiting' then raise exception 'This RFP is not in Submitted · Waiting.'; end if;
    new_status := 'submitted_shortlisted';
  elsif p_action in ('won', 'lost') then
    if r.status not in ('submitted_waiting', 'submitted_shortlisted') then raise exception 'Only a submitted RFP can be marked won or lost.'; end if;
    new_status := case p_action when 'won' then 'closed_won' else 'closed_lost' end;
    update public.rfps
      set outcome = p_action,
          furthest_stage = coalesce(furthest_stage, case r.status when 'submitted_shortlisted' then 'finalist' else 'submitted' end),
          outcome_notes = coalesce(clean_note, outcome_notes)
      where id = p_rfp_id;
  else
    raise exception 'Unknown action.';
  end if;

  update public.rfps set status = new_status where id = p_rfp_id;

  insert into public.rfp_decisions (rfp_id, kind, from_status, to_status, note)
  values (p_rfp_id, p_action, r.status, new_status, clean_note)
  returning id into decision_id;

  return decision_id;
end;
$$;

revoke execute on function public.advance_rfp(uuid, text, text, text) from public, anon;
grant execute on function public.advance_rfp(uuid, text, text, text) to authenticated;
