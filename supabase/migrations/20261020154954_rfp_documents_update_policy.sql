-- The sync function records a document's Drive file id on its row; without an update policy that silently did nothing.
create policy "Team can update rfp documents" on public.rfp_documents for update to authenticated
  using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
