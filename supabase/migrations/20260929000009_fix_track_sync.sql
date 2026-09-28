-- Fix: set_playback_state must accept an optional track_id so the host
-- can push a new track to all listeners via room_playback.
-- We create an overloaded version with 5 params (the old 4-param version
-- remains for backward compat but the client will call the new one).

create or replace function public.set_playback_state(
  p_room_id text,
  p_status text,
  p_position_ms int,
  p_expected_revision bigint,
  p_track_id text default null
)
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

  -- Allow the very first write (revision=0) or matching revision
  if v_current_rev is distinct from p_expected_revision
     and p_expected_revision != 0  -- allow bootstrap writes
  then
    return jsonb_build_object('stale', true, 'revision', v_current_rev);
  end if;

  update public.room_playback
  set status = p_status,
      position_ms = p_position_ms,
      current_track_id = coalesce(p_track_id, current_track_id),
      revision = revision + 1,
      updated_at = clock_timestamp()
  where room_id = p_room_id
  returning revision into v_current_rev;

  -- Also mirror current_track_id on the rooms table for initial page load
  if p_track_id is not null then
    update public.rooms
    set current_track_id = p_track_id
    where id = p_room_id;
  end if;

  return jsonb_build_object('success', true, 'revision', v_current_rev);
end;
$$;

-- Keep grants
revoke all on function public.set_playback_state(text, text, int, bigint, text) from public, anon;
grant execute on function public.set_playback_state(text, text, int, bigint, text) to authenticated;

-- Also create a helper RPC to fetch the current playback state so the client
-- can bootstrap its local state correctly on page load.
create or replace function public.get_playback_state(p_room_id text)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_row record;
begin
  select current_track_id, status, position_ms, revision, updated_at
  into v_row
  from public.room_playback
  where room_id = p_room_id;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object(
    'found', true,
    'trackId', v_row.current_track_id,
    'status', v_row.status,
    'positionMs', v_row.position_ms,
    'revision', v_row.revision,
    'updatedAt', v_row.updated_at
  );
end;
$$;
revoke all on function public.get_playback_state(text) from public, anon;
grant execute on function public.get_playback_state(text) to authenticated;
