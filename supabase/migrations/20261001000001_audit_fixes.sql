-- =============================================================================
-- 20261001000001_audit_fixes.sql
-- Fixes identified in the production audit.
--
-- CRIT-02: Drop conflicting vote_skip(text,text) overload
-- CRIT-03: Fix room_heartbeat to use current_profile_id() instead of auth.uid()
-- CRIT-04: Fix server_time() millisecond precision
-- MED-02:  Drop stale 4-param set_playback_state overload
-- =============================================================================

-- ─── CRIT-04: server_time() precision ─────────────────────────────────────
-- The old version did:  extract(epoch ...)::bigint * 1000
-- which truncates to whole seconds before multiplying. We need:
--   (extract(epoch ...) * 1000)::bigint
-- to preserve sub-second precision for clock sync.
create or replace function public.server_time()
returns bigint language sql stable
as $$
  select (extract(epoch from clock_timestamp()) * 1000)::bigint;
$$;
revoke all on function public.server_time from public, anon;
grant execute on function public.server_time to authenticated;


-- ─── CRIT-03: room_heartbeat uses auth.uid() but user_id is TEXT ──────────
-- auth.uid() returns UUID, but room_members.user_id stores the profile TEXT id.
-- Must use current_profile_id() which resolves the correct TEXT id.
create or replace function public.room_heartbeat(p_room_id text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;
  
  update public.room_members
  set last_seen_at = now()
  where room_id = p_room_id and user_id = public.current_profile_id();
end;
$$;
revoke all on function public.room_heartbeat from public, anon;
grant execute on function public.room_heartbeat to authenticated;


-- ─── CRIT-02: Drop the old vote_skip(text, text) overload ─────────────────
-- Migration 20260928000004 created vote_skip(p_room_id text, p_track_id text)
-- which conflicts with the correct version vote_skip(text, bigint) from
-- 20260929000003. The old one also references room_members.profile_id which
-- doesn't exist (column is user_id). Drop it safely.
drop function if exists public.vote_skip(text, text);


-- ─── MED-02: Drop stale 4-param set_playback_state ───────────────────────
-- 20260929000003 created set_playback_state(text, text, int, bigint)
-- 20260929000009 created set_playback_state(text, text, int, bigint, text)
-- The client always calls the 5-param version. Drop the 4-param overload.
drop function if exists public.set_playback_state(text, text, int, bigint);


-- ─── Ensure room_playback read policy exists ──────────────────────────────
-- The playback row needs to be readable by room participants for sync.
drop policy if exists "room_playback_select" on public.room_playback;
create policy "room_playback_select" on public.room_playback
  for select using (public.can_see_room(room_id));

-- The host needs to be able to update playback state indirectly via RPCs,
-- but RPCs run as SECURITY DEFINER so no direct UPDATE policy is needed.
-- Ensure no direct writes are allowed.
drop policy if exists "room_playback_update_none" on public.room_playback;
create policy "room_playback_update_none" on public.room_playback
  for update using (false);
drop policy if exists "room_playback_insert_none" on public.room_playback;
create policy "room_playback_insert_none" on public.room_playback
  for insert with check (false);
drop policy if exists "room_playback_delete_none" on public.room_playback;
create policy "room_playback_delete_none" on public.room_playback
  for delete using (false);
