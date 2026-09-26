const { createClient } = require('@supabase/supabase-js');

const url = 'https://lvudbyfktpymccdskmtf.supabase.co';
const key = 'sb_publishable_dqfX7hkJmFQ5SZa36nb0Dg_HoxHltld';
const supabase = createClient(url, key);

async function inspect() {
  console.log('--- Inspecting Supabase Data ---');

  // 1. Check Profiles
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('*').limit(3);
  if (pErr) console.error('Profiles error:', pErr);
  else console.log('Profiles in Supabase:', profiles?.length, 'Sample:', profiles?.[0]);

  // 2. Check Rooms
  const { data: rooms, error: rErr } = await supabase.from('rooms').select('*').limit(3);
  if (rErr) console.error('Rooms error:', rErr);
  else console.log('Rooms in Supabase:', rooms?.length, 'Sample room:', rooms?.[0]?.name);

  // 3. Check Tracks
  const { data: tracks, error: tErr } = await supabase.from('tracks').select('*').limit(3);
  if (tErr) console.error('Tracks error:', tErr);
  else console.log('Tracks in Supabase:', tracks?.length, 'Sample track:', tracks?.[0]?.title);

  // 4. Test updating a room is_live status (Admin operation)
  if (rooms && rooms.length > 0) {
    const testRoom = rooms[0];
    const { error: uErr } = await supabase.from('rooms').update({ is_live: testRoom.is_live }).eq('id', testRoom.id);
    console.log('Test Admin update room is_live:', uErr ? `Failed: ${uErr.message}` : 'SUCCESS!');
  }

  // 6. Test track insertion (Admin operation)
  const testTrackId = 'trk_test_' + Date.now();
  const { error: tInsertErr } = await supabase.from('tracks').insert({
    id: testTrackId,
    title: 'Admin Test Track',
    artist: 'Test Artist',
    artwork: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    duration: 45,
    audio_url: '/audio/track-1.wav',
    genre: 'Lo-Fi / Ambient',
  });
  console.log('Test Admin insert track:', tInsertErr ? `Failed: ${tInsertErr.message}` : 'SUCCESS!');
  if (!tInsertErr) {
    await supabase.from('tracks').delete().eq('id', testTrackId);
    console.log('Test Admin clean track: SUCCESS!');
  }
}

inspect();
