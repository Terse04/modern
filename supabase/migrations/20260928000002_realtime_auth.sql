begin;

create policy "realtime_messages_select" on realtime.messages
  for select
  to authenticated
  using (
    public.can_see_room(split_part(topic, ':', 2))
  );

create policy "realtime_messages_insert" on realtime.messages
  for insert
  to authenticated
  with check (
    (
      exists (
        select 1 from public.room_members
        where room_id = split_part(topic, ':', 2)
        and user_id = public.current_profile_id()
      )
    )
    or public.can_host_room(split_part(topic, ':', 2))
  );

commit;
