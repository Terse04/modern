-- =============================================================================
-- 20261003000001_fix_room_permissions_and_storage.sql
-- Fixes for playback permissions, storage read/write, and realtime messaging.
--
-- 1. can_control_playback(): Check host, admin, or room members if playbackPermissions = 'everyone'
-- 2. set_playback_state(): Use can_control_playback() instead of can_host_room()
-- 3. storage.objects: Fix tracks_read policy to allow any track in public.tracks
-- 4. realtime.messages: Fix user_id = public.current_profile_id() instead of auth.uid()::text
-- =============================================================================

-- ─── 1. can_control_playback function ─────────────────────────────────────────
create or replace function public.can_control_playback(p_room_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rooms r
    where r.id = p_room_id
      and (
        r.host_id = public.current_profile_id()
        or public.is_admin()
        or (
          coalesce(r.settings->>'playbackPermissions', 'everyone') = 'everyone'
          and exists (
            select 1 from public.room_members m
            where m.room_id = p_room_id and m.user_id = public.current_profile_id()
          )
        )
      )
  );
$$;
grant execute on function public.can_control_playback(text) to anon, authenticated;


-- ─── 2. Update set_playback_state to respect playbackPermissions ─────────────
create or replace function public.set_playback_state(
  p_room_id text,
  p_status text,
  p_position_ms int,
  p_expected_revision bigint,
  p_track_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_rev bigint;
begin
  if not public.can_control_playback(p_room_id) then
    raise exception 'unauthorized';
  end if;

  select revision into v_current_rev from public.room_playback where room_id = p_room_id for update;
  
  if v_current_rev != p_expected_revision then
    return jsonb_build_object('stale', true, 'revision', v_current_rev);
  end if;

  if p_track_id is not null then
    update public.room_playback
    set status = p_status,
        position_ms = p_position_ms,
        current_track_id = p_track_id,
        revision = revision + 1,
        updated_at = clock_timestamp()
    where room_id = p_room_id
    returning revision into v_current_rev;
  else
    update public.room_playback
    set status = p_status,
        position_ms = p_position_ms,
        revision = revision + 1,
        updated_at = clock_timestamp()
    where room_id = p_room_id
    returning revision into v_current_rev;
  end if;

  return jsonb_build_object('success', true, 'revision', v_current_rev);
end;
$$;
revoke all on function public.set_playback_state from public, anon;
grant execute on function public.set_playback_state(text, text, int, bigint, text) to authenticated;


-- ─── 3. Fix Storage: Allow all room listeners to stream public.tracks ─────────
drop policy if exists "tracks_read" on storage.objects;
create policy "tracks_read"
  on storage.objects for select
  using (
    bucket_id = 'tracks'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.tracks t
        where t.audio_url = name
      )
    )
  );


-- ─── 4. Fix Realtime Messaging Policies ───────────────────────────────────────
-- Non-host members previously failed due to user_id = auth.uid()::text mismatch
-- (user_id is TEXT profile id like 'usr_xxx', not UUID).
drop policy if exists "realtime_messages_insert_control" on realtime.messages;
drop policy if exists "realtime_messages_insert_social" on realtime.messages;
drop policy if exists "realtime_messages_insert" on realtime.messages;

create policy "realtime_messages_insert" on realtime.messages
  for insert
  to authenticated
  with check (
    public.can_see_room(split_part(topic, ':', 2))
    and (
      public.can_host_room(split_part(topic, ':', 2))
      or exists (
        select 1 from public.room_members 
        where room_id = split_part(topic, ':', 2) and user_id = public.current_profile_id()
      )
    )
  );
