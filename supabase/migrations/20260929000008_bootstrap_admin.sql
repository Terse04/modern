-- 1. Update guard_profile_privileges so superuser, postgres, and service_role can administer accounts
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin    is distinct from old.is_admin
     or new.is_banned is distinct from old.is_banned
     or new.role      is distinct from old.role
     or new.auth_user_id is distinct from old.auth_user_id
  then
    -- Allow direct database administrator, superuser, or service_role operations
    if current_user in ('postgres', 'service_role', 'supabase_admin') or (auth.jwt() ->> 'role') = 'service_role' then
      return new;
    end if;

    if not public.is_admin() then
      raise exception
        'is_admin, is_banned, role and auth_user_id are administrator-only'
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- 2. Bootstrap terse04 as admin
update public.profiles
set is_admin = true,
    role = 'admin'
where username = 'terse04';
