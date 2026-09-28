begin;

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert
  with check (
    -- A user can only insert a profile for themselves
    auth_user_id = auth.uid()
    -- And they cannot escalate privileges on insert
    and is_admin = false
    and is_banned = false
    and role = 'listener'
  );

-- Trigger function to force defaults on insert unless the caller is already an admin
create or replace function public.guard_profile_insert_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    NEW.is_admin := false;
    NEW.is_banned := false;
    NEW.role := 'listener';
  end if;
  return NEW;
end;
$$;

drop trigger if exists guard_profile_insert_privileges_trigger on public.profiles;
create trigger guard_profile_insert_privileges_trigger
  before insert on public.profiles
  for each row
  execute function public.guard_profile_insert_privileges();

commit;
