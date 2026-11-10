alter table public.rfps add column if not exists owner_id uuid references public.profiles (id) on delete set null default auth.uid();
update public.rfps set owner_id = created_by where owner_id is null;
comment on column public.rfps.owner_id is 'The team member responsible for this RFP. Starts as whoever added it; anyone on the team can change it.';
