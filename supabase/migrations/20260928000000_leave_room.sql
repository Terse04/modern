create or replace function public.leave_room(p_room_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_profile_id text;
begin
    v_profile_id := public.current_profile_id();
    if v_profile_id is null then
        raise exception 'Not authenticated';
    end if;

    delete from room_members where room_id = p_room_id and user_id = v_profile_id;
    
    update rooms
    set listener_count = (
        select count(*) from room_members where room_members.room_id = rooms.id
    )
    where id = p_room_id;
end;
$$;
grant execute on function public.leave_room(text) to authenticated;
