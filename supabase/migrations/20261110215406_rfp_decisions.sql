-- Every decision about an RFP, kept permanently: who, when, what the score was at that moment, and why.
alter table public.rfps add column closed_reason text;

create table public.rfp_decisions (
  id uuid primary key default gen_random_uuid(),
  rfp_id uuid not null references public.rfps (id) on delete cascade,
  kind text not null check (kind in ('move_forward', 'pass', 'reopen')),
  from_status text not null,
  to_status text not null,
  destination text check (destination in ('questions', 'proposal')),
  reason text,
  note text,
  score_total integer,
  score_band text,
  review_id uuid references public.rfp_reviews (id) on delete set null,
  decided_by uuid references public.profiles (id) on delete set null default auth.uid(),
  decided_at timestamptz not null default now()
);
create index rfp_decisions_rfp_idx on public.rfp_decisions (rfp_id, decided_at desc);
create index rfp_decisions_decided_by_idx on public.rfp_decisions (decided_by);
create index rfp_decisions_review_idx on public.rfp_decisions (review_id);

alter table public.rfp_decisions enable row level security;
create policy "Team can read decisions" on public.rfp_decisions for select to authenticated using (true);
-- Append-only: no update or delete policy. A decision can only be added, as the person making it.
create policy "Team can record their own decisions" on public.rfp_decisions for insert to authenticated
  with check (decided_by = (select auth.uid()));

-- Carries out a decision and records it in one step, so the status and the record can never disagree.
create or replace function public.decide_rfp(
  p_rfp_id uuid,
  p_decision text,
  p_destination text default null,
  p_reason text default null,
  p_note text default null,
  p_expected_status text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  r public.rfps%rowtype;
  rev record;
  new_status text;
  decision_id uuid;
  clean_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into r from public.rfps where id = p_rfp_id for update;
  if not found then raise exception 'RFP not found'; end if;
  if p_expected_status is not null and r.status <> p_expected_status then
    raise exception 'This RFP changed while you were looking at it. Reload and try again.';
  end if;

  select id, total_score, decision_band into rev from public.rfp_reviews
    where rfp_id = p_rfp_id and status = 'complete' order by created_at desc limit 1;

  if p_decision = 'move_forward' then
    if r.status <> 'evaluate_ready' then raise exception 'This RFP is not ready for that decision.'; end if;
    if rev.id is null then raise exception 'Run a fit review first.'; end if;
    if p_destination is null or p_destination not in ('questions', 'proposal') then raise exception 'Choose where to move this RFP.'; end if;
    new_status := case p_destination when 'questions' then 'questions_drafting' else 'proposal_drafting' end;
    update public.rfps set status = new_status where id = p_rfp_id;

  elsif p_decision = 'pass' then
    if r.status not in ('evaluate_ready', 'questions_drafting', 'questions_sent', 'questions_answers_in', 'proposal_drafting', 'proposal_in_review') then
      raise exception 'This RFP can''t be passed on from its current status.';
    end if;
    if rev.id is null then raise exception 'Run a fit review first.'; end if;
    if p_reason is null or p_reason not in ('Budget', 'Timeline', 'Not a fit', 'Capacity', 'Scope', 'Other') then
      raise exception 'Choose a reason for passing.';
    end if;
    new_status := 'closed_passed';
    update public.rfps
      set status = new_status, passed_from_status = r.status, passed_at = now(), closed_reason = p_reason, outcome_notes = clean_note
      where id = p_rfp_id;

  elsif p_decision = 'reopen' then
    if r.status not in ('closed_passed', 'closed_lost', 'closed_won') then raise exception 'Only a closed RFP can be reopened.'; end if;
    new_status := case r.status when 'closed_passed' then coalesce(r.passed_from_status, 'evaluate_ready') else 'submitted_waiting' end;
    update public.rfps set status = new_status, passed_from_status = null, passed_at = null, closed_reason = null where id = p_rfp_id;

  else
    raise exception 'Unknown decision.';
  end if;

  insert into public.rfp_decisions (rfp_id, kind, from_status, to_status, destination, reason, note, score_total, score_band, review_id)
  values (
    p_rfp_id, p_decision, r.status, new_status,
    case when p_decision = 'move_forward' then p_destination end,
    case when p_decision = 'pass' then p_reason end,
    clean_note, rev.total_score, rev.decision_band, rev.id
  )
  returning id into decision_id;

  return decision_id;
end;
$$;

revoke execute on function public.decide_rfp(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.decide_rfp(uuid, text, text, text, text, text) to authenticated;
