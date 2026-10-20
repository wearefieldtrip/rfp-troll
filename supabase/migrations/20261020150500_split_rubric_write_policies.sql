-- Replace the `for all` write policies with per-action ones so reads hit a single permissive policy.
drop policy "Team can write rubrics" on public.rubrics;
create policy "Team can insert rubrics" on public.rubrics for insert to authenticated with check ((select auth.uid()) is not null);
create policy "Team can update rubrics" on public.rubrics for update to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy "Team can delete rubrics" on public.rubrics for delete to authenticated using ((select auth.uid()) is not null);

drop policy "Team can write dimensions" on public.rubric_dimensions;
create policy "Team can insert dimensions" on public.rubric_dimensions for insert to authenticated with check ((select auth.uid()) is not null);
create policy "Team can update dimensions" on public.rubric_dimensions for update to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy "Team can delete dimensions" on public.rubric_dimensions for delete to authenticated using ((select auth.uid()) is not null);

drop policy "Team can write levels" on public.rubric_levels;
create policy "Team can insert levels" on public.rubric_levels for insert to authenticated with check ((select auth.uid()) is not null);
create policy "Team can update levels" on public.rubric_levels for update to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy "Team can delete levels" on public.rubric_levels for delete to authenticated using ((select auth.uid()) is not null);

drop policy "Team can write bands" on public.rubric_decision_bands;
create policy "Team can insert bands" on public.rubric_decision_bands for insert to authenticated with check ((select auth.uid()) is not null);
create policy "Team can update bands" on public.rubric_decision_bands for update to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy "Team can delete bands" on public.rubric_decision_bands for delete to authenticated using ((select auth.uid()) is not null);
