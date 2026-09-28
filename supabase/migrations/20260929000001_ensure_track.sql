-- Create ensure_track to let anyone add a track safely
create or replace function public.ensure_track(
  p_id text,
  p_title text,
  p_artist text,
  p_album text,
  p_artwork text,
  p_duration int,
  p_audio_url text,
  p_genre text
) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  -- Ensure we aren't spoofing another user's private bucket path
  if position('/' in p_audio_url) > 0 and p_audio_url not like 'http%' then
    if split_part(p_audio_url, '/', 1) != (select id from public.profiles where auth_user_id = auth.uid()) then
      raise exception 'cannot point to another users folder';
    end if;
  end if;

  insert into public.tracks (
    id, title, artist, album, artwork, duration, audio_url, genre
  ) values (
    p_id, p_title, p_artist, p_album, p_artwork, p_duration, p_audio_url, p_genre
  )
  on conflict (id) do nothing;
end;
$$;
revoke all on function public.ensure_track from public, anon;
grant execute on function public.ensure_track to authenticated;
