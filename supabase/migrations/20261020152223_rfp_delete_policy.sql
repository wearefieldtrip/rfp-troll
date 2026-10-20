-- Any signed-in team member can delete an RFP. Documents and reviews go with it (they cascade).
create policy "Team can delete rfps" on public.rfps for delete to authenticated
  using ((select auth.uid()) is not null);
