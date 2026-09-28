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

  v_profile  := 'usr_g_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  v_username := 'guest_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);

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
  v_room := left(v_slug, 48) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

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
