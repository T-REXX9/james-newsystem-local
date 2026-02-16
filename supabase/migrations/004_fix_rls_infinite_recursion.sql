-- Fix profiles RLS recursion and ensure trigger impersonates new user

-- Drop existing policies to replace them with non-recursive versions
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

-- Public read access
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using (true);

-- User-owned inserts/updates without recursive auth.uid() evaluation
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Allow service role to bypass RLS for all operations
drop policy if exists "Service role can manage all profiles" on public.profiles;
create policy "Service role can manage all profiles"
  on public.profiles for all
  using (auth.jwt()->>'role' = 'service_role');

-- Ensure profile creation trigger sets JWT claim context and remains idempotent
create or replace function public.handle_new_user()
returns trigger
set search_path = ''
language plpgsql
security definer
as $$
begin
  -- Impersonate the new user id so auth.uid() returns correctly inside RLS checks
  perform set_config('request.jwt.claim.sub', new.id::text, true);

  insert into public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    role,
    access_rights,
    birthday,
    mobile,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->>'role', 'Sales Agent'),
    coalesce(
      (new.raw_user_meta_data->'access_rights')::text[],
      array['dashboard', 'pipelines', 'mail', 'calendar', 'tasks']
    ),
    new.raw_user_meta_data->>'birthday',
    new.raw_user_meta_data->>'mobile',
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        avatar_url = excluded.avatar_url,
        role = excluded.role,
        access_rights = excluded.access_rights,
        birthday = excluded.birthday,
        mobile = excluded.mobile,
        updated_at = timezone('utc', now());
  return new;
end;
$$;

-- Re-register trigger to ensure latest function is used
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
