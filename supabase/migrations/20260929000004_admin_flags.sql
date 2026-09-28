create or replace function public.admin_set_user_flags(
  p_user_id text,
  p_is_banned boolean default null,
  p_role text default null,
  p_is_admin boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Permission denied: must be admin' using errcode = '42501';
  end if;

  if p_user_id = public.current_profile_id() then
    raise exception 'Cannot modify your own admin or banned status';
  end if;

  if p_role is not null and p_role not in ('listener', 'co_host', 'host', 'admin') then
    raise exception 'Invalid role';
  end if;

  update public.profiles
  set
    is_banned = coalesce(p_is_banned, is_banned),
    role = coalesce(p_role, role),
    is_admin = coalesce(p_is_admin, is_admin)
  where id = p_user_id;

  if not found then
    raise exception 'User not found';
  end if;
end;
$$;
revoke all on function public.admin_set_user_flags from public, anon;
grant execute on function public.admin_set_user_flags to authenticated;
