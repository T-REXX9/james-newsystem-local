-- Align existing profiles table with intended auth schema

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- RLS Policies (id = auth.uid() for writes, public read)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'Public profiles are viewable by everyone'
  ) then
    create policy "Public profiles are viewable by everyone"
      on public.profiles for select
      using (true);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'Users can insert their own profile'
  ) then
    create policy "Users can insert their own profile"
      on public.profiles for insert
      with check ((select auth.uid()) = id);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'Users can update own profile'
  ) then
    create policy "Users can update own profile"
      on public.profiles for update
      using ((select auth.uid()) = id);
  end if;
end$$;

-- Trigger function to auto-create or upsert profile
create or replace function public.handle_new_user()
returns trigger
set search_path = ''
language plpgsql
security definer
as $$
begin
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

-- Register trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
