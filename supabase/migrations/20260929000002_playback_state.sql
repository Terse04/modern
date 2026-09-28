-- 1. Create room_playback table
create table if not exists public.room_playback (
  room_id text primary key references public.rooms(id) on delete cascade,
  current_track_id text references public.tracks(id),
  revision bigint not null default 0,
  status text not null default 'paused',
  position_ms integer not null default 0,
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.room_playback enable row level security;
drop policy if exists "room_playback_select" on public.room_playback;
create policy "room_playback_select" on public.room_playback
  for select using (public.can_see_room(room_id));

-- Add table to publication
alter publication supabase_realtime add table public.room_playback;

-- Trigger to create row
create or replace function public.tr_room_insert_playback()
returns trigger language plpgsql security definer as $$
begin
  insert into public.room_playback (room_id) values (new.id);
  return new;
end;
$$;
drop trigger if exists on_room_created on public.rooms;
create trigger on_room_created
  after insert on public.rooms
  for each row execute function public.tr_room_insert_playback();

-- Backfill
insert into public.room_playback (room_id, current_track_id)
select id, current_track_id from public.rooms
on conflict (room_id) do nothing;
