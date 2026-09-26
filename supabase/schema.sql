-- ==============================================================================
-- MODERN SOCIAL LISTENING PLATFORM - SUPABASE SCHEMA & SEED SCRIPT
-- Run this in the Supabase SQL Editor: https://app.supabase.com/project/_/sql
-- ==============================================================================

-- 1. Enable Required Extensions
create extension if not exists "uuid-ossp";

-- ==============================================================================
-- 2. Create Tables
-- ==============================================================================

-- PROFILES (Users)
create table if not exists public.profiles (
  id text primary key,
  username text unique not null,
  name text not null,
  avatar text not null,
  bio text,
  current_status text default 'Listening with friends',
  stats jsonb default '{"roomsCreated":0,"roomsJoined":0,"tracksPlayed":0,"listeningStreakDays":0,"listeningHours":0}'::jsonb,
  is_admin boolean default false,
  is_banned boolean default false,
  role text default 'listener',
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- TRACKS
create table if not exists public.tracks (
  id text primary key,
  title text not null,
  artist text not null,
  album text,
  artwork text not null,
  duration integer not null default 30,
  audio_url text not null,
  genre text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- ROOMS
create table if not exists public.rooms (
  id text primary key,
  name text not null,
  description text,
  artwork text not null,
  host_id text references public.profiles(id) on delete set null,
  is_live boolean default true,
  listener_count integer default 1,
  current_track_id text references public.tracks(id) on delete set null,
  settings jsonb default '{"allowChat":true,"allowQueueAdditions":true,"playbackPermissions":"everyone","visibility":"public","maxListeners":100,"bitrateKbps":320}'::jsonb,
  tags text[] default '{}'::text[],
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- ROOM MEMBERS
create table if not exists public.room_members (
  id text primary key,
  room_id text references public.rooms(id) on delete cascade not null,
  user_id text references public.profiles(id) on delete cascade not null,
  role text default 'listener',
  status text default 'listening',
  status_text text,
  active_reaction text,
  drift_ms integer default 0,
  joined_at timestamptz default timezone('utc'::text, now()) not null,
  last_seen_at timestamptz default timezone('utc'::text, now()) not null,
  constraint unique_room_member unique (room_id, user_id)
);

-- QUEUE ITEMS
create table if not exists public.queue_items (
  id text primary key,
  room_id text references public.rooms(id) on delete cascade not null,
  track_id text references public.tracks(id) on delete cascade not null,
  added_by_id text references public.profiles(id) on delete set null,
  votes integer default 1,
  added_at timestamptz default timezone('utc'::text, now()) not null
);

-- CHAT MESSAGES
create table if not exists public.chat_messages (
  id text primary key,
  room_id text references public.rooms(id) on delete cascade not null,
  user_id text references public.profiles(id) on delete set null,
  text text not null,
  is_system boolean default false,
  reactions jsonb default '[]'::jsonb,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- ==============================================================================
-- 3. Row Level Security (RLS) Policies
-- ==============================================================================

alter table public.profiles enable row level security;
alter table public.tracks enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.queue_items enable row level security;
alter table public.chat_messages enable row level security;

-- Profiles: Allow public read, user/anon upsert
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone" on public.profiles
  for select using (true);

drop policy if exists "Anyone can insert/update profile" on public.profiles;
create policy "Anyone can insert/update profile" on public.profiles
  for all using (true) with check (true);

-- Tracks: Allow public read and inserts
drop policy if exists "Tracks are viewable by everyone" on public.tracks;
create policy "Tracks are viewable by everyone" on public.tracks
  for select using (true);

drop policy if exists "Anyone can insert tracks" on public.tracks;
create policy "Anyone can insert tracks" on public.tracks
  for insert with check (true);

-- Rooms: Viewable, creatable, and updateable by all
drop policy if exists "Rooms are viewable by everyone" on public.rooms;
create policy "Rooms are viewable by everyone" on public.rooms
  for select using (true);

drop policy if exists "Anyone can create or update rooms" on public.rooms;
create policy "Anyone can create or update rooms" on public.rooms
  for all using (true) with check (true);

-- Room Members: Viewable, joinable, updateable by all
drop policy if exists "Members are viewable by everyone" on public.room_members;
create policy "Members are viewable by everyone" on public.room_members
  for select using (true);

drop policy if exists "Anyone can join or leave room" on public.room_members;
create policy "Anyone can join or leave room" on public.room_members
  for all using (true) with check (true);

-- Queue Items: Viewable and manageable by all
drop policy if exists "Queue is viewable by everyone" on public.queue_items;
create policy "Queue is viewable by everyone" on public.queue_items
  for select using (true);

drop policy if exists "Anyone can vote or add queue item" on public.queue_items;
create policy "Anyone can vote or add queue item" on public.queue_items
  for all using (true) with check (true);

-- Chat Messages: Viewable and postable by all
drop policy if exists "Chat is viewable by everyone" on public.chat_messages;
create policy "Chat is viewable by everyone" on public.chat_messages
  for select using (true);

drop policy if exists "Anyone can post chat message" on public.chat_messages;
create policy "Anyone can post chat message" on public.chat_messages
  for insert with check (true);

-- ==============================================================================
-- 4. Enable Supabase Realtime for Multi-user Sync
-- ==============================================================================

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Add tables to realtime publication safely
do $$
begin
  begin
    alter publication supabase_realtime add table public.rooms;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.room_members;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.queue_items;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.chat_messages;
  exception when duplicate_object then null;
  end;
end $$;

-- ==============================================================================
-- 5. Seed Data (Initial Users, Tracks, Rooms, Queue, and Chat)
-- ==============================================================================

-- Profiles
insert into public.profiles (id, username, name, avatar, bio, current_status, stats)
values
  ('usr_alex', 'alex', 'Alex Rivera', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80', 'Audio explorer & late night compiler. Building sonic sanctuaries for nocturnal minds.', 'Listening in Late Night Coding', '{"roomsCreated":238,"roomsJoined":512,"tracksPlayed":1420,"listeningStreakDays":14,"listeningHours":284}'::jsonb),
  ('usr_sarah', 'sarah', 'Sarah Chen', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80', 'Ambient archivist and vinyl digger.', 'Listening in 2000s Nostalgia', '{"roomsCreated":45,"roomsJoined":210,"tracksPlayed":840,"listeningStreakDays":9,"listeningHours":120}'::jsonb),
  ('usr_marcus', 'marcus', 'Marcus Vance', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80', 'Modular synthesist and code architect.', 'Listening in Late Night Coding', '{"roomsCreated":82,"roomsJoined":340,"tracksPlayed":920,"listeningStreakDays":11,"listeningHours":170}'::jsonb),
  ('usr_elena', 'elena', 'Elena Rostova', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=300&q=80', 'Visual soundscaper & electronic rhythm collector.', 'Reacting with 🔥', '{"roomsCreated":19,"roomsJoined":180,"tracksPlayed":450,"listeningStreakDays":5,"listeningHours":68}'::jsonb),
  ('usr_david', 'david', 'David Kim', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80', 'Lo-fi beats, warm coffee, and mechanical keyboards.', 'Listening in Friday Night', '{"roomsCreated":31,"roomsJoined":290,"tracksPlayed":630,"listeningStreakDays":8,"listeningHours":94}'::jsonb),
  ('usr_maya', 'maya', 'Maya Patel', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80', 'Chilled ambient frequencies curator.', 'Listening in Late Night Coding', '{"roomsCreated":12,"roomsJoined":110,"tracksPlayed":310,"listeningStreakDays":4,"listeningHours":42}'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  avatar = excluded.avatar,
  bio = excluded.bio,
  current_status = excluded.current_status,
  stats = excluded.stats;

-- Tracks
insert into public.tracks (id, title, artist, album, artwork, duration, audio_url, genre)
values
  ('trk_1', 'Late Night Frequency', 'Artist Sonus', 'Nocturne Horizon', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80', 32, '/audio/track-1.wav', 'Lo-Fi / Ambient'),
  ('trk_2', 'Midnight Nostalgia', 'Tape Echo', 'Cassette Memories', 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=800&q=80', 28, '/audio/track-2.wav', 'Retro Synth'),
  ('trk_3', 'Analog Dreams', 'Velvet Horizon', 'Warm Saturation', 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80', 30, '/audio/track-3.wav', 'Downtempo'),
  ('trk_4', 'Deep Focus Loop', 'Stellar Drift', 'Cosmic Resonance', 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80', 34, '/audio/track-4.wav', 'Ambient Space')
on conflict (id) do update set
  title = excluded.title,
  artist = excluded.artist,
  album = excluded.album,
  artwork = excluded.artwork,
  duration = excluded.duration,
  audio_url = excluded.audio_url,
  genre = excluded.genre;

-- Rooms
insert into public.rooms (id, name, description, artwork, host_id, is_live, listener_count, current_track_id, settings, tags)
values
  ('late-night-coding', 'Late Night Coding', 'Wide cinematic snap of a developer immersed in deep focus and clean rhythm.', 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80', 'usr_alex', true, 31, 'trk_1', '{"allowChat":true,"allowQueueAdditions":true,"playbackPermissions":"everyone","visibility":"public","maxListeners":100,"bitrateKbps":320}'::jsonb, array['Coding', 'Lo-Fi', 'Night']),
  ('2000s-nostalgia', '2000s Nostalgia', 'Vintage-styled analog treasures, warm record crackles, and early millennium memories.', 'https://images.unsplash.com/photo-1539185441755-769473a23570?auto=format&fit=crop&w=800&q=80', 'usr_sarah', true, 24, 'trk_2', '{"allowChat":true,"allowQueueAdditions":true,"playbackPermissions":"voting","visibility":"public","maxListeners":50,"bitrateKbps":320}'::jsonb, array['Nostalgia', 'Retro', 'Pop']),
  ('friday-night', 'Friday Night', 'Venus sonus club vibrations, cinematic basslines, and late-hours soundscapes.', 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80', 'usr_alex', true, 18, 'trk_3', '{"allowChat":true,"allowQueueAdditions":false,"playbackPermissions":"host_only","visibility":"public","maxListeners":200,"bitrateKbps":320}'::jsonb, array['Party', 'Electronic', 'Weekend']),
  ('lo-fi-study', 'Lo-Fi Study', 'Minimalistic aesthetic, gentle rain, warm Rhodes pianos, and quiet study companionship.', 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80', 'usr_marcus', true, 42, 'trk_4', '{"allowChat":true,"allowQueueAdditions":true,"playbackPermissions":"everyone","visibility":"public","maxListeners":80,"bitrateKbps":320}'::jsonb, array['Study', 'Chill', 'Lo-Fi'])
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  artwork = excluded.artwork,
  host_id = excluded.host_id,
  is_live = excluded.is_live,
  listener_count = excluded.listener_count,
  current_track_id = excluded.current_track_id,
  settings = excluded.settings,
  tags = excluded.tags;

-- Room Members for Late Night Coding
insert into public.room_members (id, room_id, user_id, role, status, status_text, drift_ms)
values
  ('mem_1', 'late-night-coding', 'usr_alex', 'host', 'host', 'Host', 0),
  ('mem_2', 'late-night-coding', 'usr_sarah', 'listener', 'joined', 'Just Joined', 14),
  ('mem_3', 'late-night-coding', 'usr_marcus', 'listener', 'listening', 'Listening', -8),
  ('mem_4', 'late-night-coding', 'usr_elena', 'listener', 'reacting', 'Reacting', 18),
  ('mem_5', 'late-night-coding', 'usr_david', 'listener', 'listening', 'Listening', 4),
  ('mem_6', 'late-night-coding', 'usr_maya', 'listener', 'listening', 'Listening', -15)
on conflict (id) do update set
  role = excluded.role,
  status = excluded.status,
  status_text = excluded.status_text;

-- Queue Items for Late Night Coding
insert into public.queue_items (id, room_id, track_id, added_by_id, votes)
values
  ('q_1', 'late-night-coding', 'trk_1', 'usr_alex', 12),
  ('q_2', 'late-night-coding', 'trk_2', 'usr_marcus', 8),
  ('q_3', 'late-night-coding', 'trk_3', 'usr_elena', 5),
  ('q_4', 'late-night-coding', 'trk_4', 'usr_david', 3)
on conflict (id) do update set
  votes = excluded.votes;

-- Chat Messages for Late Night Coding
insert into public.chat_messages (id, room_id, user_id, text, is_system, reactions)
values
  ('msg_sys_1', 'late-night-coding', 'usr_alex', '2 people just joined', true, '[]'::jsonb),
  ('msg_1', 'late-night-coding', 'usr_sarah', 'A very nice, quiet music chatter tonight.', false, '[{"emoji":"❤️","count":3,"users":["usr_alex","usr_marcus","usr_elena"]}]'::jsonb),
  ('msg_sys_2', 'late-night-coding', 'usr_alex', '3 people just joined', true, '[]'::jsonb),
  ('msg_2', 'late-night-coding', 'usr_marcus', 'I think invited coding session is going great, thank you that''s cool!', false, '[{"emoji":"🔥","count":4,"users":["usr_alex","usr_sarah","usr_david","usr_maya"]}]'::jsonb),
  ('msg_3', 'late-night-coding', 'usr_elena', 'Who has the stash for the next nostalgia track? Upvoting queue item #2!', false, '[{"emoji":"👏","count":2,"users":["usr_alex","usr_marcus"]}]'::jsonb)
on conflict (id) do update set
  text = excluded.text,
  reactions = excluded.reactions;

-- Done!
