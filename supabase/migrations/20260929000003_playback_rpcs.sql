-- Server time
create or replace function public.server_time()
returns bigint language sql stable
as $$
  select extract(epoch from clock_timestamp())::bigint * 1000;
$$;
revoke all on function public.server_time from public, anon;
grant execute on function public.server_time to authenticated;

-- Internal advance
create or replace function public._advance_room_track_internal(p_room_id text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_next_item record;
  v_new_revision bigint;
begin
  -- Lock row
  perform 1 from public.room_playback where room_id = p_room_id for update;

  -- Get next item
  select id, track_id into v_next_item
  from public.queue_items
  where room_id = p_room_id
  order by votes desc, added_at asc
  limit 1;

  if v_next_item is null then
    return jsonb_build_object('advanced', false);
  end if;

  -- Update playback state
  update public.room_playback
  set current_track_id = v_next_item.track_id,
      revision = revision + 1,
      status = 'playing',
      position_ms = 0,
      updated_at = clock_timestamp()
  where room_id = p_room_id
  returning revision into v_new_revision;

  -- Delete from queue
  delete from public.queue_items where id = v_next_item.id;
  
  -- Clear votes for old track
  delete from public.room_skip_votes where room_id = p_room_id;

  return jsonb_build_object('advanced', true, 'track_id', v_next_item.track_id, 'revision', v_new_revision);
end;
$$;
revoke all on function public._advance_room_track_internal from public, anon, authenticated;


-- Advance RPC
create or replace function public.advance_room_track(p_room_id text, p_expected_revision bigint)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_current_rev bigint;
begin
  if not (public.can_host_room(p_room_id) or public.is_admin()) then
    raise exception 'unauthorized';
  end if;

  select revision into v_current_rev from public.room_playback where room_id = p_room_id for update;
  
  if v_current_rev != p_expected_revision then
    return jsonb_build_object('stale', true, 'revision', v_current_rev);
  end if;

  return public._advance_room_track_internal(p_room_id);
end;
$$;
revoke all on function public.advance_room_track from public, anon;
grant execute on function public.advance_room_track to authenticated;


-- Set Playback State
create or replace function public.set_playback_state(p_room_id text, p_status text, p_position_ms int, p_expected_revision bigint)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_current_rev bigint;
begin
  if not (public.can_host_room(p_room_id) or public.is_admin()) then
    raise exception 'unauthorized';
  end if;

  select revision into v_current_rev from public.room_playback where room_id = p_room_id for update;
  
  if v_current_rev != p_expected_revision then
    return jsonb_build_object('stale', true, 'revision', v_current_rev);
  end if;

  update public.room_playback
  set status = p_status,
      position_ms = p_position_ms,
      revision = revision + 1,
      updated_at = clock_timestamp()
  where room_id = p_room_id
  returning revision into v_current_rev;

  return jsonb_build_object('success', true, 'revision', v_current_rev);
end;
$$;
revoke all on function public.set_playback_state from public, anon;
grant execute on function public.set_playback_state to authenticated;


-- Play Next
create or replace function public.play_next(p_room_id text, p_queue_item_id text, p_expected_revision bigint)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_current_rev bigint;
  v_track_id text;
begin
  if not (public.can_host_room(p_room_id) or public.is_admin()) then
    raise exception 'unauthorized';
  end if;

  select revision into v_current_rev from public.room_playback where room_id = p_room_id for update;
  
  if v_current_rev != p_expected_revision then
    return jsonb_build_object('stale', true, 'revision', v_current_rev);
  end if;

  select track_id into v_track_id from public.queue_items where id::text = p_queue_item_id and room_id = p_room_id;
  if v_track_id is null then
    return jsonb_build_object('error', 'queue item not found');
  end if;

  update public.room_playback
  set current_track_id = v_track_id,
      revision = revision + 1,
      status = 'playing',
      position_ms = 0,
      updated_at = clock_timestamp()
  where room_id = p_room_id
  returning revision into v_current_rev;

  delete from public.queue_items where id::text = p_queue_item_id;
  delete from public.room_skip_votes where room_id = p_room_id;

  return jsonb_build_object('success', true, 'track_id', v_track_id, 'revision', v_current_rev);
end;
$$;
revoke all on function public.play_next from public, anon;
grant execute on function public.play_next to authenticated;


-- Vote Skip
create or replace function public.vote_skip(p_room_id text, p_expected_revision bigint)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_current_rev bigint;
  v_track_id text;
  v_member_count int;
  v_vote_count int;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'unauthorized';
  end if;

  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = v_uid
  ) then
    raise exception 'not a member of this room';
  end if;

  select revision, current_track_id into v_current_rev, v_track_id
  from public.room_playback where room_id = p_room_id for update;

  if v_current_rev != p_expected_revision then
    return jsonb_build_object('stale', true, 'revision', v_current_rev);
  end if;
  
  if v_track_id is null then
    return jsonb_build_object('error', 'no track playing');
  end if;

  -- Insert vote using gen_random_uuid
  insert into public.room_skip_votes (id, room_id, track_id, profile_id)
  values (gen_random_uuid(), p_room_id, v_track_id, (select id from public.profiles where auth_user_id = v_uid))
  on conflict do nothing;

  -- Count eligible members (seen in last 60s)
  select count(*) into v_member_count
  from public.room_members
  where room_id = p_room_id
    and last_seen_at > now() - interval '60 seconds';

  -- Count votes for current track
  select count(*) into v_vote_count
  from public.room_skip_votes
  where room_id = p_room_id and track_id = v_track_id;

  if v_vote_count >= greatest(1, ceil(v_member_count::numeric / 2)) then
    return public._advance_room_track_internal(p_room_id);
  end if;

  return jsonb_build_object('advanced', false, 'votes', v_vote_count, 'required', greatest(1, ceil(v_member_count::numeric / 2)));
end;
$$;
revoke all on function public.vote_skip from public, anon;
grant execute on function public.vote_skip to authenticated;


-- Room Heartbeat
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
  where room_id = p_room_id and user_id = auth.uid();
end;
$$;
revoke all on function public.room_heartbeat from public, anon;
grant execute on function public.room_heartbeat to authenticated;
