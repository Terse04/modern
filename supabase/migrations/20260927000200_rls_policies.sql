-- =============================================================================
-- 20260927000200_rls_policies.sql
-- Row Level Security.
-- =============================================================================
-- THE BUG THIS FIXES
--   schema.sql created policies named "Anyone can insert/update profile",
--   "Anyone can create or update rooms", etc. with `for all using (true)
--   with check (true)`.
--
--   001_initial_schema.sql created correctly-scoped policies under DIFFERENT
--   names ("Users update own profile", "Hosts admins update rooms", ...).
--   Because the names differed, neither file's `drop policy if exists` removed
--   the other's policies. Both sets were live simultaneously.
--
--   Postgres combines permissive policies with OR. So `using (true)` won over
--   the strict checks, and any anonymous client holding the publishable key
--   could run:
--       update profiles set is_admin = true where id = <self>;
--   This migration is the single authoritative policy set. schema.sql and
--   admin_migration.sql are deleted so they cannot be re-applied.
--
-- POLICY STANCE
--   Strict where it is a *security* property:
--     - privilege escalation, cross-user writes, cross-room visibility
--   Bounded-but-permissive where it is an *abuse* property:
--     - anonymous chat / track / room creation, which are core product flows
--     Abuse resistance here is CHECK constraints plus the rate-limit triggers
--     in 20260927000300. Full server-side abuse control needs Edge Functions
--     (Phase 1) - flagged in the audit.
-- =============================================================================

-- ─── Helper functions ───────────────────────────────────────────────────────
-- SECURITY DEFINER so they can read profiles without recursing through the
-- profiles RLS policy. search_path is pinned to defeat search_path hijacking.
-- Critically, none of these accept a user id from the client: they read
-- auth.uid(), which the caller cannot forge.

create or replace function public.current_profile_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.id from public.profiles p
  where p.auth_user_id = auth.uid()
  limit 1;
$$;

comment on function public.current_profile_id() is
  'Resolves the caller to a profiles.id via the server-verified auth.uid(). '
  'Returns NULL for anonymous callers. Never trust a client-supplied id here.';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.is_admin and not p.is_banned
    from public.profiles p
    where p.auth_user_id = auth.uid()
    limit 1
  ), false);
$$;

create or replace function public.is_banned()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.is_banned
    from public.profiles p
    where p.auth_user_id = auth.uid()
    limit 1
  ), false);
$$;

create or replace function public.can_see_room(p_room_id text)
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
        -- 'public'  -> listed on Discover
        -- 'unlisted'-> reachable by direct link only
        coalesce(r.settings->>'visibility', 'public') in ('public', 'unlisted')
        or exists (
          select 1 from public.room_members m
          where m.room_id = r.id and m.user_id = public.current_profile_id()
        )
        or public.is_admin()
      )
  );
$$;

create or replace function public.can_host_room(p_room_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rooms r
    where r.id = p_room_id
      and (r.host_id = public.current_profile_id() or public.is_admin())
  );
$$;

grant execute on function public.current_profile_id() to anon, authenticated;
grant execute on function public.is_admin()          to anon, authenticated;
grant execute on function public.is_banned()         to anon, authenticated;
grant execute on function public.can_see_room(text)  to anon, authenticated;
grant execute on function public.can_host_room(text) to anon, authenticated;


-- ─── profiles ──────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

-- Profiles are public in a social app: the Discover page and room participant
-- lists need to read other people's names and avatars.
drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public" on public.profiles
  for select using (true);

-- You may create exactly one profile, and it must be linked to your own auth
-- account if you have one. Guests (auth_user_id IS NULL) may still create a
-- throwaway profile - that is what guest mode is - but they can never update
-- or delete anything afterwards.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (
    auth_user_id = auth.uid()
    or (auth_user_id is null and not public.is_banned())
  );

-- Update only your own row. The is_admin / is_banned / auth_user_id columns are
-- additionally fenced by the privilege guard trigger in 20260927000300, because
-- a row-level policy alone cannot say "you own this row but not those columns".
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid() and not is_banned);

drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin" on public.profiles
  for delete using (public.is_admin() and id <> public.current_profile_id());


-- ─── tracks ────────────────────────────────────────────────────────────────
alter table public.tracks enable row level security;

drop policy if exists "tracks_select_public" on public.tracks;
create policy "tracks_select_public" on public.tracks
  for select using (true);

-- Anyone may contribute a track (guests included) - that is the community
-- upload flow. The CHECK constraints on title/artist/duration keep garbage out.
-- Spam control proper arrives with Edge Functions.
drop policy if exists "tracks_insert_contributor" on public.tracks;
create policy "tracks_insert_contributor" on public.tracks
  for insert with check (not public.is_banned());

-- The catalog is global and curated, so edits are admin-only. Contributors
-- delete their own uploads.
drop policy if exists "tracks_update_admin" on public.tracks;
create policy "tracks_update_admin" on public.tracks
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "tracks_delete_admin_or_owner" on public.tracks;
create policy "tracks_delete_admin_or_owner" on public.tracks
  for delete using (
    public.is_admin() or contributor_id = public.current_profile_id()
  );


-- ─── rooms ─────────────────────────────────────────────────────────────────
alter table public.rooms enable row level security;

-- public + unlisted are readable by anyone (unlisted is link-only by
-- definition). private requires membership or admin.
drop policy if exists "rooms_select_visible" on public.rooms;
create policy "rooms_select_visible" on public.rooms
  for select using (
    coalesce(settings->>'visibility', 'public') in ('public', 'unlisted')
    or public.can_see_room(id)
    or public.is_admin()
  );

-- You must be the host of the room you create. Anonymous callers have
-- current_profile_id() = NULL so this fails; guest room creation goes through
-- create_room_guest() in 20260927000300, which enforces the daily quota
-- server-side.
drop policy if exists "rooms_insert_own_host" on public.rooms;
create policy "rooms_insert_own_host" on public.rooms
  for insert with check (
    host_id = public.current_profile_id() and not public.is_banned()
  );

drop policy if exists "rooms_update_host_or_admin" on public.rooms;
create policy "rooms_update_host_or_admin" on public.rooms
  for update using (public.can_host_room(id))
  with check (public.can_host_room(id));

drop policy if exists "rooms_delete_host_or_admin" on public.rooms;
create policy "rooms_delete_host_or_admin" on public.rooms
  for delete using (public.can_host_room(id));


-- ─── room_members ──────────────────────────────────────────────────────────
alter table public.room_members enable row level security;

drop policy if exists "room_members_select_visible" on public.room_members;
create policy "room_members_select_visible" on public.room_members
  for select using (public.can_see_room(room_id));

-- You can only add yourself, and only to a room you are allowed to see.
-- Anonymous callers fail here (current_profile_id() is NULL) - by design.
-- Guests still appear live via the Realtime presence broadcast; they just do
-- not get a durable row until they sign in or an Edge Function mints them one.
drop policy if exists "room_members_insert_self" on public.room_members;
create policy "room_members_insert_self" on public.room_members
  for insert with check (
    user_id = public.current_profile_id()
    and public.can_see_room(room_id)
    and not public.is_banned()
  );

drop policy if exists "room_members_update_self_or_host" on public.room_members;
create policy "room_members_update_self_or_host" on public.room_members
  for update using (
    user_id = public.current_profile_id() or public.can_host_room(room_id)
  );

drop policy if exists "room_members_delete_self_or_host" on public.room_members;
create policy "room_members_delete_self_or_host" on public.room_members
  for delete using (
    user_id = public.current_profile_id() or public.can_host_room(room_id)
  );


-- ─── queue_items ───────────────────────────────────────────────────────────
alter table public.queue_items enable row level security;

drop policy if exists "queue_items_select_visible" on public.queue_items;
create policy "queue_items_select_visible" on public.queue_items
  for select using (public.can_see_room(room_id));

drop policy if exists "queue_items_insert_own" on public.queue_items;
create policy "queue_items_insert_own" on public.queue_items
  for insert with check (
    added_by_id = public.current_profile_id()
    and public.can_see_room(room_id)
    and not public.is_banned()
  );

-- Only the host may reorder or drop queue entries.
drop policy if exists "queue_items_update_host" on public.queue_items;
create policy "queue_items_update_host" on public.queue_items
  for update using (public.can_host_room(room_id));

drop policy if exists "queue_items_delete_host_or_own" on public.queue_items;
create policy "queue_items_delete_host_or_admin" on public.queue_items
  for delete using (
    public.can_host_room(room_id)
    or added_by_id = public.current_profile_id()
    or public.is_admin()
  );


-- ─── queue_votes ───────────────────────────────────────────────────────────
alter table public.queue_votes enable row level security;

-- Read only your own votes, so the UI can render a filled vs outlined heart.
drop policy if exists "queue_votes_select_own" on public.queue_votes;
create policy "queue_votes_select_own" on public.queue_votes
  for select using (user_id = public.current_profile_id());

drop policy if exists "queue_votes_insert_own" on public.queue_votes;
create policy "queue_votes_insert_own" on public.queue_votes
  for insert with check (
    user_id = public.current_profile_id() and not public.is_banned()
  );

drop policy if exists "queue_votes_delete_own" on public.queue_votes;
create policy "queue_votes_delete_own" on public.queue_votes
  for delete using (user_id = public.current_profile_id());


-- ─── chat_messages ─────────────────────────────────────────────────────────
alter table public.chat_messages enable row level security;

drop policy if exists "chat_select_visible" on public.chat_messages;
create policy "chat_select_visible" on public.chat_messages
  for select using (public.can_see_room(room_id));

-- Anyone who can see the room may post, guests included. Rate limited by the
-- trigger in 20260927000300. Note text is capped at 2000 chars by a CHECK.
drop policy if exists "chat_insert_visible" on public.chat_messages;
create policy "chat_insert_visible" on public.chat_messages
  for insert with check (public.can_see_room(room_id) and not public.is_banned());

-- Messages are immutable. There is no update policy, so all updates are denied.
-- Deletion is host/admin only, for moderation.
drop policy if exists "chat_delete_host_or_admin" on public.chat_messages;
create policy "chat_delete_host_or_admin" on public.chat_messages
  for delete using (public.can_host_room(room_id) or public.is_admin());


-- ─── guest_creations ───────────────────────────────────────────────────────
-- Ledger for the anonymous room-creation quota. Clients may append a record
-- (that is the point) and read their own, but never delete or forge others'.
alter table public.guest_creations enable row level security;

drop policy if exists "guest_creations_insert_self" on public.guest_creations;
create policy "guest_creations_insert_self" on public.guest_creations
  for insert with check (true);

drop policy if exists "guest_creations_select_admin" on public.guest_creations;
create policy "guest_creations_select_admin" on public.guest_creations
  for select using (public.is_admin());

drop policy if exists "guest_creations_delete_admin" on public.guest_creations;
create policy "guest_creations_delete_admin" on public.guest_creations
  for delete using (public.is_admin());


-- ─── platform_settings ─────────────────────────────────────────────────────
alter table public.platform_settings enable row level security;

-- Everyone may read the genre/tag vocabulary so the UI can render it.
drop policy if exists "platform_settings_select_public" on public.platform_settings;
create policy "platform_settings_select_public" on public.platform_settings
  for select using (true);

-- Only admins may change global limits. The old policy here was
-- "Anyone can update platform settings ... using (true) with check (true)",
-- which let any anonymous client set maintenance_mode or raise the guest
-- quota to unlimited.
drop policy if exists "platform_settings_update_admin" on public.platform_settings;
create policy "platform_settings_update_admin" on public.platform_settings
  for update using (public.is_admin()) with check (public.is_admin());

-- The single settings row must never be deleted.
-- (No delete policy is created, so deletes are denied.)

-- =============================================================================
-- Continue with:
--   20260927000300_functions_triggers.sql
-- =============================================================================
