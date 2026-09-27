-- =============================================================================
-- 20260927000100_core_schema.sql
-- Core tables.
-- =============================================================================
-- Column names here are dictated by what the application code actually reads
-- and writes. Verified against:
--   src/services/roomService.ts
--   src/services/adminService.ts
--   src/services/trackService.ts
--   src/services/profileService.ts
--   src/stores/useAuthStore.ts
--   src/types/index.ts
--
-- Two deliberate divergences from the old schema.sql:
--
--   1. profiles.id is TEXT, with a separate auth_user_id UUID column.
--      Why: the app supports two identity kinds that share one table.
--        - Guests      -> client-generated id like 'usr_l3k9x2_a7f1' (useAuthStore
--                         createGuestProfile). Cannot be a uuid.
--        - Real signups-> Supabase auth.users.id, which IS a uuid.
--      Forcing both into a uuid PK would break guest mode; forcing both into
--      text would break the FK to auth.users. Splitting the concerns lets RLS
--      key on auth_user_id = auth.uid() (server-verifiable) while guests keep
--      working.
--
--   2. queue_items uses added_by_id / votes / added_at.
--      Why: the live table had added_by / vote_count / position from the old
--      migration, while roomService.addQueueTrack() has always written
--      added_by_id and votes. Every insert was failing with an undefined-column
--      error that the code did not check. This is the schema the app expects.
-- =============================================================================

-- ─── profiles ──────────────────────────────────────────────────────────────
create table public.profiles (
  id             text primary key,
  auth_user_id   uuid unique references auth.users (id) on delete cascade,
  username       text unique not null,
  name           text not null,
  avatar         text not null,
  bio            text,
  current_status text not null default 'Listening with friends',

  -- Aggregates. Kept in sync by 20260927000300_bump_listening_stats().
  stats jsonb not null default '{"roomsCreated":0,"roomsJoined":0,"tracksPlayed":0,"listeningStreakDays":0,"listeningHours":0}'::jsonb,

  -- Privileges. Never writable by the row owner - see the privilege guard
  -- trigger in 20260927000300. RLS alone cannot express "you may edit your
  -- profile but not the is_admin column on it".
  is_admin  boolean not null default false,
  is_banned boolean not null default false,
  role      text not null default 'listener',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_role_check
    check (role in ('listener', 'co_host', 'host', 'admin')),
  constraint profiles_username_format
    check (username ~ '^[a-z0-9_]{2,32}$')
);

comment on column public.profiles.auth_user_id is
  'Links to Supabase Auth. NULL for guest profiles, which are unverified.';

create index profiles_auth_user_id_idx
  on public.profiles (auth_user_id) where auth_user_id is not null;
create index profiles_username_lower_idx
  on public.profiles (lower(username));

-- ─── tracks ────────────────────────────────────────────────────────────────
create table public.tracks (
  id         text primary key default ('trk_' || gen_random_uuid()::text),
  title      text not null check (length(trim(title)) > 0),
  artist     text not null check (length(trim(artist)) > 0),
  album      text,
  artwork    text,
  duration   integer not null check (duration > 0 and duration <= 60 * 60 * 6),
  audio_url  text not null check (length(trim(audio_url)) > 0),
  genre      text,
  contributor_id text references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on constraint tracks_duration_check on public.tracks is
  'duration > 0 rejects the fabricated 180s fallback that extractAudioMetadata '
  'previously produced for undecodable files. See src/utils/audioMetadata.ts.';

create index tracks_created_at_idx on public.tracks (created_at desc);
create index tracks_contributor_idx  on public.tracks (contributor_id);

-- ─── rooms ─────────────────────────────────────────────────────────────────
create table public.rooms (
  id               text primary key default ('room_' || gen_random_uuid()::text),
  name             text not null check (length(trim(name)) between 1 and 80),
  description      text check (length(description) <= 500),
  artwork          text,
  host_id          text references public.profiles (id) on delete set null,
  is_live          boolean not null default true,
  listener_count   integer not null default 0 check (listener_count >= 0),
  current_track_id text references public.tracks (id) on delete set null,
  settings         jsonb not null default
    '{"allowChat":true,"allowQueueAdditions":true,"playbackPermissions":"everyone","visibility":"public","maxListeners":100,"bitrateKbps":320}'::jsonb,
  tags             text[] not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint rooms_visibility_check
    check (settings->>'visibility' in ('public', 'unlisted', 'private')),
  constraint rooms_playback_permissions_check
    check (settings->>'playbackPermissions' in ('host_only', 'everyone', 'voting'))
);

create index rooms_is_live_listener_idx
  on public.rooms (listener_count desc) where is_live;
create index rooms_host_idx on public.rooms (host_id);
create index rooms_settings_gin  on public.rooms using gin (settings);
create index rooms_tags_gin      on public.rooms using gin (tags);

-- ─── room_members ──────────────────────────────────────────────────────────
create table public.room_members (
  id              text primary key default ('mem_' || gen_random_uuid()::text),
  room_id         text not null references public.rooms (id) on delete cascade,
  user_id         text not null references public.profiles (id) on delete cascade,
  role            text not null default 'listener',
  status          text not null default 'joined',
  status_text     text,
  active_reaction text,
  drift_ms        integer not null default 0,
  joined_at       timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),

  constraint room_members_unique unique (room_id, user_id),
  constraint room_members_role_check
    check (role in ('host', 'co_host', 'listener'))
);

create index room_members_room_idx on public.room_members (room_id);
create index room_members_user_idx on public.room_members (user_id);

-- ─── queue_items ───────────────────────────────────────────────────────────
create table public.queue_items (
  id           text primary key default ('qi_' || gen_random_uuid()::text),
  room_id      text not null references public.rooms (id) on delete cascade,
  track_id     text not null references public.tracks (id) on delete cascade,
  added_by_id  text references public.profiles (id) on delete set null,
  votes        integer not null default 1,
  position     integer not null default 0,
  added_at     timestamptz not null default now(),

  constraint queue_items_unique_track_per_room unique (room_id, track_id),
  constraint queue_items_votes_check check (votes >= 0)
);

create index queue_items_room_position_idx
  on public.queue_items (room_id, position, votes desc);
create index queue_items_track_idx on public.queue_items (track_id);

-- ─── queue_votes ───────────────────────────────────────────────────────────
-- Why a side table instead of a votes counter?
--   The counter alone cannot answer "did *I* vote?", which the UI needs for the
--   filled/outlined heart. It also cannot be decremented idempotently under
--   concurrent taps. One row per (item, user) makes voting a real upsert.
create table public.queue_votes (
  queue_item_id text not null references public.queue_items (id) on delete cascade,
  user_id       text not null references public.profiles (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (queue_item_id, user_id)
);

create index queue_votes_user_idx on public.queue_votes (user_id);

-- ─── chat_messages ─────────────────────────────────────────────────────────
create table public.chat_messages (
  id         text primary key default ('msg_' || gen_random_uuid()::text),
  room_id    text not null references public.rooms (id) on delete cascade,
  user_id    text references public.profiles (id) on delete set null,
  text       text not null check (length(text) between 1 and 2000),
  is_system  boolean not null default false,
  reactions  jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index chat_messages_room_created_idx
  on public.chat_messages (room_id, created_at desc);

-- ─── guest_creations ───────────────────────────────────────────────────────
-- Server-side guest quota ledger. Replaces the localStorage counter in
-- src/services/roomLimitService.ts, which any user could clear with one
-- devtools call. Uniqueness is enforced by the fingerprint column.
create table public.guest_creations (
  id          bigint generated always as identity primary key,
  fingerprint text not null,
  created_at  timestamptz not null default now(),
  constraint guest_creations_fingerprint_format
    check (fingerprint ~ '^[a-zA-Z0-9_-]{8,128}$')
);

create index guest_creations_lookup_idx
  on public.guest_creations (fingerprint, created_at desc);

-- ─── platform_settings ─────────────────────────────────────────────────────
-- Single-row table. id is pinned to 1 by the check constraint.
create table public.platform_settings (
  id                      integer primary key default 1,
  guest_daily_room_limit  integer not null default 5  check (guest_daily_room_limit >= 0),
  max_listeners_per_room  integer not null default 100 check (max_listeners_per_room >= 1),
  available_genres        text[] not null default
    array['Lo-Fi / Ambient','Retro Synth','Downtempo','Ambient Space',
          'Deep House','Electronic','Hip-Hop','Chillwave','Indie Pop'],
  available_tags          text[] not null default
    array['Coding','Lo-Fi','Night','Study','Chill','Retro','Party',
          'Weekend','Focus','Community','Experimental'],
  allowed_bitrates        integer[] not null default array[128,192,256,320],
  allow_guest_creation   boolean not null default true,
  maintenance_mode       boolean not null default false,
  updated_at             timestamptz not null default now(),

  constraint platform_settings_single_row check (id = 1)
);

insert into public.platform_settings (id) values (1) on conflict (id) do nothing;

-- =============================================================================
-- Continue with:
--   20260927000200_rls_policies.sql
--   20260927000300_functions_triggers.sql
-- =============================================================================
