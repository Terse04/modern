-- Storage: upload folder = auth.uid()::text
drop policy if exists "tracks_read_own_or_admin" on storage.objects;
drop policy if exists "tracks_insert" on storage.objects;

create policy "tracks_read"
  on storage.objects for select
  using (
    bucket_id = 'tracks'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.tracks t
        join public.queue_items q on q.track_id = t.id
        where t.audio_url = name
          and public.can_see_room(q.room_id)
      )
      or exists (
        select 1 from public.room_playback r
        join public.tracks t on t.id = r.current_track_id
        where t.audio_url = name
          and public.can_see_room(r.room_id)
      )
    )
  );

create policy "tracks_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'tracks'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Realtime policies
drop policy if exists "realtime_messages_select" on realtime.messages;
drop policy if exists "realtime_messages_insert" on realtime.messages;
drop policy if exists "realtime_messages_insert_control" on realtime.messages;
drop policy if exists "realtime_messages_insert_social" on realtime.messages;

create policy "realtime_messages_select" on realtime.messages
  for select
  to authenticated
  using (
    public.can_see_room(split_part(topic, ':', 2))
  );

create policy "realtime_messages_insert_control" on realtime.messages
  for insert
  to authenticated
  with check (
    split_part(topic, ':', 3) = 'control'
    and (
      public.can_host_room(split_part(topic, ':', 2))
      or (
        (select settings->>'playbackPermissions' from public.rooms where id = split_part(topic, ':', 2)) = 'everyone'
        and exists (
          select 1 from public.room_members 
          where room_id = split_part(topic, ':', 2) and user_id = auth.uid()
        )
      )
    )
  );

create policy "realtime_messages_insert_social" on realtime.messages
  for insert
  to authenticated
  with check (
    split_part(topic, ':', 3) = 'social'
    and exists (
      select 1 from public.room_members 
      where room_id = split_part(topic, ':', 2) and user_id = auth.uid()
    )
  );
