-- Allowed sign-in domains. Enforced in the database so it holds even if the client check is bypassed.
create or replace function public.is_allowed_email_domain(email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(split_part(email, '@', 2)) in ('wearefieldtrip.com', 'hellofieldtrip.com')
$$;

-- Reject sign-ups from any other domain.
create or replace function public.enforce_allowed_email_domain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_allowed_email_domain(new.email) then
    raise exception 'Sign-ups are restricted to Fieldtrip accounts';
  end if;
  return new;
end;
$$;

create trigger enforce_allowed_email_domain
  before insert on auth.users
  for each row execute function public.enforce_allowed_email_domain();

-- One profile per team member.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Team members can read profiles"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger functions are not meant to be called through the API.
revoke execute on function public.enforce_allowed_email_domain() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
