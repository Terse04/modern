-- ============================================================
-- Together / Modern — Initial Schema Migration
-- Paste this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/lvudbyfktpymccdskmtf/sql/new
-- ============================================================

create extension if not exists "uuid-ossp";

-- ─── 1. PROFILES ─────────────────────────────────────────
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique not null,
  name          text not null,
  avatar        text,
  bio           text,
  current_status text,
  role          text default 'listener',
  is_admin      boolean default false,
  is_banned     boolean default false,
  created_at    timestamptz default now()
);
alter table profiles enable row level security;
create policy "Profiles viewable" on profiles for select using (true);
create policy "Users update own profile" on profiles for update using (auth.uid()::uuid = id);
create policy "Users insert own profile" on profiles for insert with check (auth.uid()::uuid = id);
create policy "Admins update any profile" on profiles for update using (
  exists (select 1 from profiles p where p.id = auth.uid()::uuid and p.is_admin = true)
);
create policy "Admins delete profiles" on profiles for delete using (
  exists (select 1 from profiles p where p.id = auth.uid()::uuid and p.is_admin = true)
);

-- ─── 2. TRACKS ───────────────────────────────────────────
create table if not exists tracks (
  id         text primary key default ('trk_' || gen_random_uuid()::text),
  title      text not null,
  artist     text not null,
  album      text,
  artwork    text,
  duration   integer not null default 30,
  audio_url  text not null,
  genre      text,
  created_at timestamptz default now()
);
alter table tracks enable row level security;
create policy "Tracks viewable" on tracks for select using (true);
create policy "Admin insert tracks" on tracks for insert with check (
  exists (select 1 from profiles p where p.id = auth.uid()::uuid and p.is_admin = true)
);
create policy "Admin delete tracks" on tracks for delete using (
  exists (select 1 from profiles p where p.id = auth.uid()::uuid and p.is_admin = true)
);

-- ─── 3. ROOMS ────────────────────────────────────────────
create table if not exists rooms (
  id               text primary key default ('room_' || gen_random_uuid()::text),
  name             text not null,
  description      text,
  artwork          text,
  host_id          uuid references profiles(id) on delete cascade,
  is_live          boolean default true,
  listener_count   integer default 1,
  current_track_id text references tracks(id) on delete set null,
  settings         jsonb default '{"allowChat":true,"allowQueueAdditions":true,"playbackPermissions":"everyone","visibility":"public","maxListeners":100,"bitrateKbps":320}',
  tags             text[] default '{}',
  created_at       timestamptz default now()
);
alter table rooms enable row level security;
create policy "Public rooms viewable" on rooms for select using (
  (settings->>'visibility') = 'public'
  or host_id = auth.uid()::uuid
  or exists (select 1 from profiles p where p.id = auth.uid()::uuid and p.is_admin = true)
);
create policy "Auth users create rooms" on rooms for insert with check (auth.uid() is not null);
create policy "Hosts admins update rooms" on rooms for update using (
  host_id = auth.uid()::uuid
  or exists (select 1 from profiles p where p.id = auth.uid()::uuid and p.is_admin = true)
);
create policy "Hosts admins delete rooms" on rooms for delete using (
  host_id = auth.uid()::uuid
  or exists (select 1 from profiles p where p.id = auth.uid()::uuid and p.is_admin = true)
);

-- ─── 4. QUEUE ITEMS ──────────────────────────────────────
create table if not exists queue_items (
  id         text primary key default ('qi_' || gen_random_uuid()::text),
  room_id    text references rooms(id) on delete cascade,
  track_id   text references tracks(id) on delete cascade,
  added_by   uuid references profiles(id) on delete set null,
  vote_count integer default 0,
  position   integer default 0,
  created_at timestamptz default now()
);
alter table queue_items enable row level security;
create policy "Queue visible" on queue_items for select using (true);
create policy "Auth add queue" on queue_items for insert with check (auth.uid() is not null);
create policy "Remove queue items" on queue_items for delete using (
  added_by = auth.uid()::uuid
  or exists (select 1 from rooms r where r.id = room_id and r.host_id = auth.uid()::uuid)
  or exists (select 1 from profiles p where p.id = auth.uid()::uuid and p.is_admin = true)
);

-- ─── 5. CHAT MESSAGES ────────────────────────────────────
create table if not exists chat_messages (
  id        text primary key default ('msg_' || gen_random_uuid()::text),
  room_id   text references rooms(id) on delete cascade,
  user_id   uuid references profiles(id) on delete set null,
  username  text not null,
  avatar    text,
  content   text not null,
  timestamp timestamptz default now()
);
alter table chat_messages enable row level security;
create policy "Chat visible" on chat_messages for select using (true);
create policy "Anyone send chat" on chat_messages for insert with check (true);

-- ─── 6. GUEST CREATIONS ──────────────────────────────────
create table if not exists guest_creations (
  id          bigint primary key generated always as identity,
  fingerprint text not null,
  created_at  timestamptz default now()
);
create index if not exists guest_fp_idx on guest_creations(fingerprint, created_at);
alter table guest_creations enable row level security;
create policy "Record guest creation" on guest_creations for insert with check (true);
create policy "Admin view guest creations" on guest_creations for select using (
  exists (select 1 from profiles p where p.id = auth.uid()::uuid and p.is_admin = true)
);

-- ─── 7. PLATFORM SETTINGS ────────────────────────────────
create table if not exists platform_settings (
  id                     integer primary key default 1,
  guest_daily_room_limit integer default 5,
  max_listeners_per_room integer default 100,
  available_genres       text[] default array['Lo-Fi / Ambient','Retro Synth','Downtempo','Ambient Space','Deep House','Electronic','Hip-Hop','Chillwave','Indie Pop'],
  available_tags         text[] default array['Coding','Lo-Fi','Night','Study','Chill','Retro','Party','Weekend','Focus','Community','Experimental'],
  allow_guest_creation   boolean default true,
  maintenance_mode       boolean default false,
  updated_at             timestamptz default now(),
  constraint single_row check (id = 1)
);
insert into platform_settings (id) values (1) on conflict do nothing;
alter table platform_settings enable row level security;
create policy "Read platform settings" on platform_settings for select using (true);
create policy "Admin update settings" on platform_settings for update using (
  exists (select 1 from profiles p where p.id = auth.uid()::uuid and p.is_admin = true)
);

-- ─── 8. REALTIME ─────────────────────────────────────────
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table chat_messages;
alter publication supabase_realtime add table queue_items;

-- ─── 9. AUTO-PROFILE TRIGGER ─────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
declare
  raw_username text;
  clean_username text;
begin
  raw_username := coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1)
  );
  clean_username := regexp_replace(lower(raw_username), '[^a-z0-9_]', '', 'g');
  if clean_username = '' then
    clean_username := 'user_' || substring(new.id::text, 1, 8);
  end if;
  insert into public.profiles (id, username, name, avatar, role, is_admin)
  values (
    new.id,
    clean_username,
    coalesce(new.raw_user_meta_data->>'name', clean_username),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80'
    ),
    'listener',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── 10. MAKE YOURSELF ADMIN ─────────────────────────────
-- After signing up, run this ONE TIME with your username:
-- UPDATE profiles SET is_admin = true, role = 'admin' WHERE username = 'your_username';
