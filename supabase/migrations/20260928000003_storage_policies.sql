-- 20260928000003_storage_policies.sql
drop policy if exists "tracks_read_own_or_admin" on storage.objects;

create policy "tracks_read_own_or_admin"
  on storage.objects for select
  using (
    bucket_id = 'tracks'
    and (
      public.is_admin()
      or owner_id = auth.uid()::text
      or exists (
        select 1 from public.profiles p
        where p.auth_user_id = auth.uid()
          and p.id = (storage.foldername(name))[1]
      )
      or exists (
        select 1 from public.tracks t
        join public.queue_items q on q.track_id = t.id
        where t.audio_url = name
          and public.can_see_room(q.room_id)
      )
      or exists (
        select 1 from public.rooms r
        join public.tracks t on t.id = r.current_track_id
        where t.audio_url = name
          and public.can_see_room(r.id)
      )
    )
  );
