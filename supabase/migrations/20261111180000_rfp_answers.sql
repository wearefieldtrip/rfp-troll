-- Step 2: the issuer's answers. Each batch is a row that exists before any reading starts, so a failure never loses it.
create table public.rfp_answers (
  id uuid primary key default gen_random_uuid(),
  rfp_id uuid not null references public.rfps (id) on delete cascade,
  received_on date not null,
  file_name text,
  -- A staged upload; cleared once the file is in the client's Drive folder.
  storage_path text,
  drive_file_id text,
  pasted_text text,
  status text not null default 'reading' check (status in ('reading', 'done', 'failed')),
  error text,
  -- What this batch changed: points, unanswered questions, other agencies, moved score lines, changed dates and budget.
  result jsonb,
  -- The re-score made from these answers.
  review_id uuid references public.rfp_reviews (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (file_name is not null or pasted_text is not null)
);
create index rfp_answers_rfp_idx on public.rfp_answers (rfp_id, created_at desc);
create index rfp_answers_review_idx on public.rfp_answers (review_id);
create index rfp_answers_created_by_idx on public.rfp_answers (created_by);

alter table public.rfp_answers enable row level security;
create policy "Team can read answers" on public.rfp_answers for select to authenticated using (true);
create policy "Team can add answers" on public.rfp_answers for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "Team can update answers" on public.rfp_answers for update to authenticated
  using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);

-- Move forward is now also possible from Questions, always to Proposal.
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
    if r.status not in ('evaluate_ready', 'questions_sent', 'questions_answers_in') then raise exception 'This RFP is not ready for that decision.'; end if;
    if rev.id is null then raise exception 'Run a fit review first.'; end if;
    if p_destination is null or p_destination not in ('questions', 'proposal') then raise exception 'Choose where to move this RFP.'; end if;
    if r.status <> 'evaluate_ready' and p_destination <> 'proposal' then raise exception 'From Questions the next step is Proposal.'; end if;
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
