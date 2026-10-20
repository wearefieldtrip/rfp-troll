-- Run in the Supabase SQL editor AFTER confirming v1 looks right on the Rubric page.
-- Retires the structured rubric tables and the old jsonb save function; the rubric now lives in rubrics.content.
drop function public.save_rubric_version(jsonb, jsonb);
drop table public.rubric_levels;
drop table public.rubric_dimensions;
drop table public.rubric_decision_bands;
alter table public.rubrics drop column scale_max;
