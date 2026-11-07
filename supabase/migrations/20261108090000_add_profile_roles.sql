-- Roles are persisted on profiles; user metadata is only an input at signup.
alter table public.profiles
  add column role text not null default 'customer'
  check (role in ('customer', 'seller'));

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text;
begin
  requested_role := case
    when new.raw_user_meta_data ->> 'role' = 'seller' then 'seller'
    else 'customer'
  end;

  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    requested_role
  );
  return new;
end;
$$;

-- A user may edit profile details, but must never promote their own account.
drop policy if exists "Users can create their own profile" on public.profiles;
revoke insert, update on public.profiles from authenticated;
grant update (display_name, phone, avatar_url) on public.profiles to authenticated;
