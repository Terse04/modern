-- ==============================================================================
-- ADMIN & PLATFORM GOVERNANCE MIGRATION
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/lvudbyfktpymccdskmtf/sql/new
-- ==============================================================================

-- 1. Add admin & moderation columns to profiles table
alter table public.profiles
  add column if not exists is_admin boolean default false,
  add column if not exists is_banned boolean default false,
  add column if not exists role text default 'listener';

-- Grant admin role to Alex Rivera by default
update public.profiles
set is_admin = true, role = 'admin'
where username = 'alex';

-- 2. Create Platform Settings table for cloud persistence of admin limits & types
create table if not exists public.platform_settings (
  id text primary key default 'global',
  settings jsonb not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Enable RLS on platform settings
alter table public.platform_settings enable row level security;

drop policy if exists "Platform settings are viewable by everyone" on public.platform_settings;
create policy "Platform settings are viewable by everyone" on public.platform_settings
  for select using (true);

drop policy if exists "Anyone can update platform settings" on public.platform_settings;
create policy "Anyone can update platform settings" on public.platform_settings
  for all using (true) with check (true);

-- Insert default platform settings row
insert into public.platform_settings (id, settings)
values (
  'global',
  '{
    "guestDailyRoomLimit": 5,
    "maxListenersPerRoom": 100,
    "availableGenres": [
      "Lo-Fi / Ambient",
      "Retro Synth",
      "Downtempo",
      "Ambient Space",
      "Deep House",
      "Electronic",
      "Hip-Hop",
      "Chillwave",
      "Indie Pop"
    ],
    "availableTags": [
      "Coding",
      "Lo-Fi",
      "Night",
      "Study",
      "Chill",
      "Retro",
      "Party",
      "Weekend",
      "Focus",
      "Community",
      "Experimental"
    ],
    "allowedBitrates": [128, 192, 256, 320],
    "allowGuestCreation": true,
    "maintenanceMode": false
  }'::jsonb
)
on conflict (id) do nothing;
