-- Ensure profile creation trigger can satisfy RLS by impersonating the new user
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
