/* global process, console */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  // Try to login as terse04, assuming password is password or test
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'terse04@example.com', // guess email, or we can sign up a new user
    password: 'password123'
  });

  if (error) {
    console.log("Login failed, creating new user...");
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: `test_${Date.now()}@example.com`,
      password: 'password123',
      options: { data: { username: `test_${Date.now()}` } }
    });
    if (signUpError) {
      console.error("Signup error:", signUpError);
      process.exit(1);
    }
    console.log("Signed up:", signUpData.user.id);
  } else {
    console.log("Logged in:", data.user.id);
  }

  // Get current profile
  const { data: session } = await supabase.auth.getSession();
  const { data: profile } = await supabase.from('profiles').select('*').eq('auth_user_id', session.session.user.id).single();
  
  if (!profile) {
    console.error("Profile not found");
    return;
  }
  console.log("Profile ID:", profile.id);

  const { data: profileIdData, error: rpcError } = await supabase.rpc('current_profile_id');
  console.log("RPC current_profile_id():", profileIdData, "Error:", rpcError);

  // Try to insert a track first
  await supabase.from('tracks').upsert({
    id: 'test_track',
    title: 'Test',
    artist: 'Test',
    audio_url: 'http://example.com/test.mp3',
    duration: 120
  });

  // Try to insert a room
  const { data: room, error: roomError } = await supabase.from('rooms').insert({
    name: 'Test Room ' + Date.now(),
    host_id: profile.id,
    is_live: true,
    listener_count: 1,
    current_track_id: 'test_track',
    settings: {
      allowChat: true,
      allowQueueAdditions: true,
      playbackPermissions: 'everyone',
      visibility: 'public',
      maxListeners: 50,
      bitrateKbps: 320
    }
  });

  if (roomError) {
    console.error("Room insert error:", roomError);
  } else {
    console.log("Room inserted successfully!", room);
  }
}

test();
