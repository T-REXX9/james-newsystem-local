-- Enhance profile creation trigger with logging and validation

create table if not exists public.profile_creation_logs (
  id bigint generated always as identity primary key,
  user_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  success boolean default false,
  error_message text,
  metadata jsonb
);

create index if not exists profile_creation_logs_user_id_idx on public.profile_creation_logs (user_id);

create or replace function public.handle_new_user()
returns trigger
set search_path = ''
language plpgsql
security definer
as $$
declare
  v_access_rights text[];
begin
  perform set_config('request.jwt.claim.sub', new.id::text, true);

  if new.email is null or new.email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$' then
    insert into public.profile_creation_logs (user_id, success, error_message, metadata)
    values (new.id, false, 'Invalid email received in trigger', to_jsonb(new));
    return new;
  end if;

  v_access_rights := coalesce(
    (new.raw_user_meta_data->'access_rights')::text[],
    array['dashboard', 'pipelines', 'mail', 'calendar', 'tasks']
  );

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
      v_access_rights,
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

    insert into public.profile_creation_logs (user_id, success, metadata)
    values (new.id, true, jsonb_build_object('email', new.email, 'role', coalesce(new.raw_user_meta_data->>'role', 'Sales Agent')));
  exception
    when others then
      insert into public.profile_creation_logs (user_id, success, error_message, metadata)
      values (new.id, false, SQLERRM, jsonb_build_object('email', new.email, 'role', coalesce(new.raw_user_meta_data->>'role', 'Sales Agent')));
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
