-- Saves an edited rubric as the next version and makes it the active one, atomically.
-- Runs with the caller's rights, so the table RLS policies still apply.
create or replace function public.save_rubric_version(p_dimensions jsonb, p_bands jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  new_id uuid;
  new_version integer;
  dim jsonb;
  dim_id uuid;
  lvl jsonb;
  band jsonb;
  pos integer := 0;
begin
  select coalesce(max(version), 0) + 1 into new_version from public.rubrics;

  update public.rubrics set is_active = false where is_active;
  insert into public.rubrics (version, is_active) values (new_version, true) returning id into new_id;

  for dim in select * from jsonb_array_elements(p_dimensions) loop
    pos := pos + 1;
    insert into public.rubric_dimensions (rubric_id, position, title)
      values (new_id, pos, dim ->> 'title') returning id into dim_id;

    for lvl in select * from jsonb_array_elements(dim -> 'levels') loop
      insert into public.rubric_levels (dimension_id, score, label, description, is_auto_no_go)
        values (
          dim_id,
          (lvl ->> 'score')::integer,
          lvl ->> 'label',
          lvl ->> 'description',
          coalesce((lvl ->> 'is_auto_no_go')::boolean, false)
        );
    end loop;
  end loop;

  pos := 0;
  for band in select * from jsonb_array_elements(p_bands) loop
    pos := pos + 1;
    insert into public.rubric_decision_bands (rubric_id, position, min_score, max_score, label, action, tone)
      values (
        new_id,
        pos,
        (band ->> 'min_score')::integer,
        (band ->> 'max_score')::integer,
        band ->> 'label',
        band ->> 'action',
        band ->> 'tone'
      );
  end loop;

  return new_id;
end;
$$;

revoke execute on function public.save_rubric_version(jsonb, jsonb) from public, anon;
grant execute on function public.save_rubric_version(jsonb, jsonb) to authenticated;
