-- =============================================================================
-- 20260927000300_functions_triggers.sql
-- Triggers, RPCs, realtime publication, storage bucket.
-- =============================================================================
-- Run after 20260927000200_rls_policies.sql
-- =============================================================================


-- ─── 1. updated_at maintenance ─────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger rooms_touch_updated_at
  before update on public.rooms
  for each row execute function public.touch_updated_at();


-- ─── 2. PRIVILEGE GUARD  (the fix for the critical finding) ───────────────
-- The profiles UPDATE RLS policy already restricts writes to your own row:
--
--     create policy "profiles_update_own" ...
--       using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid())
--
-- But that policy is row-scoped, not column-scoped. Without this trigger, a
-- signed-in user could still run, against their OWN row:
--
--     update profiles set is_admin = true where auth_user_id = auth.uid();
--
-- which passes the policy and grants themselves the admin dashboard. Postgres
-- RLS cannot express "you own this row but not those columns", so we do it
-- here. SECURITY DEFINER so the is_admin() lookup is not blocked by the RLS
-- policy currently being evaluated.
--
-- This is the single most important statement in the entire migration.
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
    if not public.is_admin() then
      raise exception
        'is_admin, is_banned, role and auth_user_id are administrator-only'
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_privilege_guard
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();


-- ─── 3. Auto-profile on signup ─────────────────────────────────────────────
-- Creates a profiles row keyed by auth_user_id whenever an auth user appears.
-- The app's useAuthStore previously looked profiles up by .eq('id', session.user.id),
-- which cannot work now that profiles.id is TEXT and auth.users.id is UUID.
-- It must query .eq('auth_user_id', session.user.id) instead - see the
-- companion change in src/stores/useAuthStore.ts.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base    text;
  v_candidate text;
  v_try     integer := 0;
begin
  v_base := regexp_replace(
    lower(coalesce(
      new.raw_user_meta_data ->> 'username',
      split_part(coalesce(new.email, ''), '@', 1),
      'user'
    )),
    '[^a-z0-9_]', '', 'g'
  );

  if v_base = '' or length(v_base) < 2 then
    v_base := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  v_base := left(v_base, 24);

  -- Resolve username collisions deterministically.
  v_candidate := v_base;
  while exists (select 1 from public.profiles where username = v_candidate) loop
    v_try := v_try + 1;
    if v_try > 50 then
      raise exception 'could not allocate a unique username for %', new.id;
    end if;
    v_candidate := v_base || '_' || v_try;
  end loop;

  insert into public.profiles (id, auth_user_id, username, name, avatar, role)
  values (
    'usr_' || substr(replace(new.id::text, '-', ''), 1, 12),
    new.id,
    v_candidate,
    left(coalesce(new.raw_user_meta_data ->> 'name', v_candidate), 60),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80'
    ),
    'listener'
  )
  on conflict (auth_user_id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ─── 4. Room host is always a member ───────────────────────────────────────
-- roomService and the UI both assume the host appears in room_members with
-- role='host'. Without this, can_see_room() would fail for a host whose
-- membership row was never written, locking them out of their own private room.
create or replace function public.sync_room_host_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.host_id is null then
    return new;
  end if;

  insert into public.room_members (room_id, user_id, role, status, status_text)
  values (new.id, new.host_id, 'host', 'host', 'Host')
  on conflict (room_id, user_id) do update
    set role = 'host', status = 'host', status_text = 'Host';

  -- If the room changed hands, demote the previous host.
  if tg_op = 'UPDATE' and old.host_id is distinct from new.host_id
     and old.host_id is not null then
    update public.room_members
       set role = 'listener', status = 'listening', status_text = 'Listening'
     where room_id = new.id and user_id = old.host_id and role = 'host';
  end if;

  return new;
end $$;

create trigger rooms_sync_host_membership
  after insert or update of host_id on public.rooms
  for each row execute function public.sync_room_host_membership();


-- ─── 5. Room capacity enforcement ──────────────────────────────────────────
-- Finally gives settings.maxListeners an effect. It was previously dead
-- config: stored, displayed, editable in the admin UI, read by nothing.
create or replace function public.enforce_room_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap integer;
  v_count integer;
begin
  select coalesce((r.settings ->> 'maxListeners')::integer, 100)
    into v_cap
    from public.rooms r
   where r.id = new.room_id;

  if v_cap is null then
    return new;
  end if;

  select count(*) into v_count
    from public.room_members m
   where m.room_id = new.room_id;

  if v_count >= v_cap then
    raise exception 'room "%" is full (maxListeners = %)', new.room_id, v_cap
      using errcode = 'P0001';
  end if;

  return new;
end $$;

create trigger room_members_enforce_capacity
  before insert on public.room_members
  for each row execute function public.enforce_room_capacity();


-- ─── 6. Chat rate limit ────────────────────────────────────────────────────
-- The realtime broadcast channel has no rate limit, so a single client could
-- flood every peer. This bounds persisted chat. 5 messages / 10s / user.
create or replace function public.enforce_chat_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent integer;
begin
  if new.is_system then
    return new;
  end if;

  select count(*) into v_recent
    from public.chat_messages m
   where m.room_id = new.room_id
     and m.user_id is not distinct from new.user_id
     and m.created_at > now() - interval '10 seconds';

  if v_recent >= 5 then
    raise exception 'slow down: at most 5 chat messages per 10 seconds'
      using errcode = 'P0001';
  end if;

  return new;
end $$;

create trigger chat_messages_rate_limit
  before insert on public.chat_messages
  for each row execute function public.enforce_chat_rate_limit();


-- ─── 7. Track upload rate limit ────────────────────────────────────────────
-- 20 uploads per hour per contributor. Anonymous contributors are all NULL,
-- so the fallback buckets every anonymous upload into one global counter.
create or replace function public.enforce_track_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent integer;
begin
  select count(*) into v_recent
    from public.tracks t
   where t.contributor_id is not distinct from new.contributor_id
     and t.created_at > now() - interval '1 hour';

  if v_recent >= 20 then
    raise exception 'upload limit reached: at most 20 tracks per hour'
      using errcode = 'P0001';
  end if;

  return new;
end $$;

create trigger tracks_rate_limit
  before insert on public.tracks
  for each row execute function public.enforce_track_rate_limit();


-- ─── 8. Vote RPC ───────────────────────────────────────────────────────────
-- Replaces the broken client-side toggle in roomService.voteQueueItem(), which
-- read the in-memory demo store before the Supabase branch (so it always
-- returned null against a real database) and hardcoded hasVoted: false on read.
--
-- Idempotent, race-safe, and keeps the denormalised votes counter in sync.
-- Returns the new has_voted state so the caller can update the UI directly.
create or replace function public.toggle_queue_vote(p_queue_item_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    text;
  v_room   text;
  v_track  text;
  v_voted  boolean;
begin
  v_uid := public.current_profile_id();
  if v_uid is null then
    raise exception 'sign in to vote' using errcode = '42501';
  end if;
  if public.is_banned() then
    raise exception 'banned users cannot vote' using errcode = '42501';
  end if;

  select room_id, track_id into v_room, v_track
    from public.queue_items
   where id = p_queue_item_id;

  if v_room is null then
    raise exception 'queue item % not found', p_queue_item_id using errcode = 'P0002';
  end if;

  if not public.can_see_room(v_room) then
    raise exception 'not permitted' using errcode = '42501';
  end if;

  -- One vote per user per track per room, even if the track somehow appears
  -- twice in the queue.
  if exists (
    select 1
      from public.queue_votes v
      join public.queue_items qi on qi.id = v.queue_item_id
     where qi.room_id = v_room
       and qi.track_id = v_track
       and v.user_id = v_uid
       and v.queue_item_id <> p_queue_item_id
  ) then
    raise exception 'you have already voted for this track in this room'
      using errcode = 'P0001';
  end if;

  select exists (select 1 from public.queue_votes
                  where queue_item_id = p_queue_item_id and user_id = v_uid)
    into v_voted;

  if v_voted then
    delete from public.queue_votes
     where queue_item_id = p_queue_item_id and user_id = v_uid;
  else
    insert into public.queue_votes (queue_item_id, user_id)
    values (p_queue_item_id, v_uid)
    on conflict do nothing;
  end if;

  update public.queue_items q
     set votes = (select count(*) from public.queue_votes v where v.queue_item_id = q.id)
   where q.id = p_queue_item_id;

  return not v_voted;
end $$;

grant execute on function public.toggle_queue_vote(text) to authenticated;


-- ─── 9. Guest room creation RPC ────────────────────────────────────────────
-- Replaces the localStorage counter in src/services/roomLimitService.ts, which
-- any user defeats with one devtools call, plus the silent-failure insert in
-- roomService.createRoom().
--
-- RLS deliberately refuses anonymous room creation (rooms_insert_own_host
-- requires host_id = current_profile_id(), which is NULL when anonymous). So
-- guests go through this SECURITY DEFINER entry point, which enforces the
-- daily quota against the server-side guest_creations ledger BEFORE writing
-- anything. This is the smallest correct fix that does not require Edge
-- Functions; Phase 1 should move it there.
create or replace function public.create_room_guest(
  p_fingerprint          text,
  p_name                 text,
  p_description          text    default null,
  p_playback_permissions text    default 'everyone',
  p_visibility           text    default 'public',
  p_max_listeners        integer default 50,
  p_allow_chat           boolean default true,
  p_allow_queue          boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit     integer;
  v_used      integer;
  v_profile   text;
  v_room      text;
  v_slug      text;
  v_username  text;
begin
  -- Authenticated users must use the normal insert path so that RLS applies.
  if auth.uid() is not null then
    raise exception 'authenticated callers must insert into rooms directly'
      using errcode = '42501';
  end if;

  if p_fingerprint !~ '^[a-zA-Z0-9_-]{8,128}$' then
    raise exception 'invalid fingerprint' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 or length(p_name) > 80 then
    raise exception 'room name must be 1-80 characters' using errcode = '22023';
  end if;
  if length(coalesce(p_description, '')) > 500 then
    raise exception 'description must be at most 500 characters' using errcode = '22023';
  end if;
  if p_playback_permissions not in ('host_only', 'everyone', 'voting') then
    raise exception 'invalid playbackPermissions' using errcode = '22023';
  end if;
  if p_visibility not in ('public', 'unlisted', 'private') then
    raise exception 'invalid visibility' using errcode = '22023';
  end if;

  select guest_daily_room_limit into v_limit
    from public.platform_settings where id = 1;
  v_limit := coalesce(v_limit, 5);

  if v_limit = 0 then
    raise exception 'guest room creation is currently disabled'
      using errcode = '42501';
  end if;

  select count(*) into v_used
    from public.guest_creations g
   where g.fingerprint = p_fingerprint
     and g.created_at >= date_trunc('day', now() at time zone 'utc');

  if v_used >= v_limit then
    raise exception 'guest room limit reached (% per day). Sign in to create more rooms.', v_limit
      using errcode = 'P0001';
  end if;

  insert into public.guest_creations (fingerprint) values (p_fingerprint);

  v_profile  := 'usr_g_' || substr(encode(gen_random_bytes(9), 'hex'), 1, 12);
  v_username := 'guest_' || substr(encode(gen_random_bytes(5), 'hex'), 1, 10);

  insert into public.profiles (id, username, name, avatar)
  values (
    v_profile,
    v_username,
    'Guest Host',
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80'
  );

  v_slug := trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'));
  if v_slug = '' then
    v_slug := 'room';
  end if;
  -- Suffix removes the collision case that roomService.createRoom() had, where
  -- "My Room!" and "My-Room" both produced the same primary key and the insert
  -- error was discarded.
  v_room := left(v_slug, 48) || '-' || substr(encode(gen_random_bytes(3), 'hex'), 1, 6);

  insert into public.rooms (
    id, name, description, host_id, is_live, listener_count, settings, tags
  )
  values (
    v_room,
    p_name,
    p_description,
    v_profile,
    true,
    1,
    jsonb_build_object(
      'allowChat', p_allow_chat,
      'allowQueueAdditions', p_allow_queue,
      'playbackPermissions', p_playback_permissions,
      'visibility', p_visibility,
      'maxListeners', greatest(1, least(p_max_listeners, 1000)),
      'bitrateKbps', 320
    ),
    array['New', 'Community']
  );

  return jsonb_build_object(
    'room_id',        v_room,
    'profile_id',     v_profile,
    'username',       v_username,
    'remaining_today', greatest(0, v_limit - v_used - 1)
  );
end $$;

grant execute on function public.create_room_guest(
  text, text, text, text, text, integer, boolean, boolean
) to anon, authenticated;


-- ─── 10. Guest join RPC ────────────────────────────────────────────────────
-- room_members RLS requires user_id = current_profile_id(), which is NULL for
-- anonymous callers, so guests cannot persist membership. They still appear
-- live over Realtime. This RPC exists so Phase 1 can add a signed guest token;
-- for now it only serves authenticated users and exists to keep the shape
-- stable across the migration.
create or replace function public.join_room(p_room_id text)
returns public.room_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid text;
  v_row public.room_members;
begin
  v_uid := public.current_profile_id();
  if v_uid is null then
    raise exception 'sign in to join a room' using errcode = '42501';
  end if;
  if not public.can_see_room(p_room_id) then
    raise exception 'room not found' using errcode = '42501';
  end if;

  insert into public.room_members (room_id, user_id, role, status, status_text)
  values (p_room_id, v_uid, 'listener', 'listening', 'Listening')
  on conflict (room_id, user_id) do update
    set last_seen_at = now(), status = 'listening'
  returning * into v_row;

  update public.rooms
     set listener_count = (
       select count(*) from public.room_members where room_id = p_room_id
     )
   where id = p_room_id;

  return v_row;
end $$;

grant execute on function public.join_room(text) to authenticated;


-- ─── 11. Realtime publication ──────────────────────────────────────────────
-- Public tables only. Never add profiles, guest_creations or
-- platform_settings - postgres_realtime would stream those changes to anyone
-- subscribed.
do $$
begin
  begin alter publication supabase_realtime add table public.rooms;         exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.room_members;  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.queue_items;   exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.queue_votes;    exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.chat_messages;  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.tracks;        exception when duplicate_object then null; end;
end $$;


-- ─── 12. Storage bucket ────────────────────────────────────────────────────
-- PRIVATE, deliberately. The old setup used getPublicUrl() on a public
-- 'tracks' bucket, which made every community upload permanently world-readable
-- and unlisted-by-link.
--
-- BREAKING CHANGE: src/services/storageService.ts calls getPublicUrl() and
-- stores that URL in tracks.audio_url. It must switch to
-- createSignedUrl(path, 3600) and the tracks table must store the storage
-- *path*, not a public URL. Tracked as a Phase 1 item.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tracks', 'tracks', false, 52428800,
  array['audio/mpeg','audio/mp4','audio/wav','audio/x-wav','audio/ogg',
        'audio/webm','audio/flac','audio/aac','image/jpeg','image/png','image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Enforces the 50 MB limit the upload modal advertises but never applied, and
-- the 50 MB / MIME allowlist that were previously only client-side checks.
create policy "tracks_read_own_or_admin"
  on storage.objects for select
  using (
    bucket_id = 'tracks'
    and (
      public.is_admin()
      or owner_id = auth.uid()::text
      or exists (select 1 from public.profiles p
                  where p.auth_user_id = auth.uid()
                    and p.id = (storage.foldername(name))[1])
    )
  );

create policy "tracks_insert_authenticated"
  on storage.objects for insert
  with check (
    bucket_id = 'tracks'
    and auth.uid() is not null
    and (storage.foldername(name))[1] is not null
  );

create policy "tracks_update_own"
  on storage.objects for update
  using (bucket_id = 'tracks' and owner_id = auth.uid()::text);

create policy "tracks_delete_own_or_admin"
  on storage.objects for delete
  using (
    bucket_id = 'tracks'
    and (public.is_admin() or owner_id = auth.uid()::text)
  );


-- ─── 13. Make yourself admin ───────────────────────────────────────────────
-- One-time, run manually after your first sign-in. Note this is the ONLY
-- supported way to grant admin, and the username is NOT used as an identity
-- check anywhere (the old adminService.ts compared username === 'alex',
-- which anyone could satisfy by registering that name).
--
--   update public.profiles
--      set is_admin = true, role = 'admin'
--    where auth_user_id = (select auth.uid());
--
-- =============================================================================
-- Migrations complete.
--   Remaining Phase 0 app-side work:
--     - useAuthStore: query profiles by auth_user_id, not id
--     - useAuthStore: stop upserting profiles on signUp (the trigger owns it)
--     - roomService: call toggle_queue_vote / join_room / create_room_guest
--     - roomService: read added_by_id:profiles(*) and map to addedBy
--     - storageService: signed URLs + store storage path, not public URL
--     - adminService: stop deriving isAdmin from username
-- =============================================================================
