-- Ensure we revoke anon access from leave_room if it wasn't already revoked
revoke all on function public.leave_room from public, anon;
grant execute on function public.leave_room to authenticated;
