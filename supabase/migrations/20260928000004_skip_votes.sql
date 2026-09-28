-- 20260928000004_skip_votes.sql

create table public.room_skip_votes (
  id uuid primary key default uuid_generate_v4(),
  room_id text references public.rooms(id) on delete cascade not null,
  track_id text references public.tracks(id) on delete cascade not null,
  profile_id text references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique(room_id, track_id, profile_id)
);

alter table public.room_skip_votes enable row level security;

create policy "room_skip_votes_read" on public.room_skip_votes
  for select using (public.can_see_room(room_id));

-- We do not allow direct inserts; must use RPC
create policy "room_skip_votes_insert_none" on public.room_skip_votes
  for insert with check (false);
create policy "room_skip_votes_update_none" on public.room_skip_votes
  for update using (false);
create policy "room_skip_votes_delete_none" on public.room_skip_votes
  for delete using (false);

-- RPC for atomic voting
create or replace function public.vote_skip(p_room_id text, p_track_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid text;
  v_member_count int;
  v_vote_count int;
  v_threshold int;
  v_next_track_id text;
  v_next_queue_id uuid;
begin
  v_uid := public.current_profile_id();
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id and profile_id = v_uid
  ) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  -- Insert vote (ignore if already voted)
  insert into public.room_skip_votes (room_id, track_id, profile_id)
  values (p_room_id, p_track_id, v_uid)
  on conflict do nothing;

  -- Check if threshold met
  select count(*) into v_member_count
  from public.room_members
  where room_id = p_room_id;

  select count(*) into v_vote_count
  from public.room_skip_votes
  where room_id = p_room_id and track_id = p_track_id;

  v_threshold := greatest(1, ceil(v_member_count::numeric / 2));

  if v_vote_count >= v_threshold then
    -- Pop next track from queue
    select id, track_id into v_next_queue_id, v_next_track_id
    from public.queue_items
    where room_id = p_room_id
    order by votes desc, added_at asc
    limit 1;

    if v_next_queue_id is not null then
      delete from public.queue_items where id = v_next_queue_id;
      update public.rooms set current_track_id = v_next_track_id where id = p_room_id;
    else
      -- If queue empty, maybe we set current_track_id = null? 
      -- For now, just leave it or let client handle empty queue.
      -- The app usually relies on host for open-library fallbacks.
    end if;

    return true;
  end if;

  return false;
end;
$$;

grant execute on function public.vote_skip(text, text) to authenticated;
