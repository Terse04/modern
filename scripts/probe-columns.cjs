/**
 * READ-ONLY column prober.
 *
 * PostgREST returns no column keys for an empty table, so the inventory script
 * could not report the shape of tracks / rooms / queue_items / chat_messages /
 * guest_creations. This probes each candidate column individually: PostgREST
 * answers "column <t>.<c> does not exist" for unknown columns, which is a
 * reliable existence oracle.
 *
 * SELECT only. No writes.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const env = { ...loadEnv(path.join(__dirname, '..', '.env')), ...process.env };
const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY
);

const CANDIDATES = {
  tracks: [
    'id', 'title', 'artist', 'album', 'artwork', 'duration', 'audio_url',
    'genre', 'created_at',
  ],
  rooms: [
    'id', 'name', 'description', 'artwork', 'host_id', 'is_live', 'listener_count',
    'current_track_id', 'settings', 'tags', 'created_at', 'updated_at',
  ],
  queue_items: [
    'id', 'room_id', 'track_id', 'added_by_id', 'added_by', 'votes',
    'vote_count', 'position', 'added_at', 'created_at',
  ],
  chat_messages: [
    'id', 'room_id', 'user_id', 'username', 'avatar', 'text', 'content',
    'is_system', 'reactions', 'timestamp', 'created_at',
  ],
  guest_creations: ['id', 'fingerprint', 'created_at'],
  profiles: ['stats', 'updated_at', 'is_admin', 'is_banned', 'role'],
};

async function hasColumn(table, col) {
  const { error } = await supabase.from(table).select(col).limit(1);
  if (!error) return true;
  const msg = error.message || String(error);
  if (/does not exist/i.test(msg)) return false;
  // e.g. permission denied on column -> column exists
  return !/column/i.test(msg) || !/does not exist/i.test(msg);
}

(async () => {
  for (const [table, cols] of Object.entries(CANDIDATES)) {
    const present = [];
    const absent = [];
    for (const c of cols) {
      if (c.includes('*')) continue;
      (await hasColumn(table, c) ? present : absent).push(c);
    }
    console.log(`\n${table}`);
    console.log(`  present: ${present.join(', ') || '(none)'}`);
    console.log(`  absent : ${absent.join(', ')}`);
  }

  // Does room_members reference a text user_id while profiles.id is uuid?
  // Compare the stored values' shapes.
  console.log('\n' + '='.repeat(72));
  console.log('ORPHAN / TYPE CHECK');
  console.log('='.repeat(72));
  const { data: members } = await supabase
    .from('room_members')
    .select('id, room_id, user_id, role')
    .limit(10);
  if (members && members.length) {
    console.log('room_members sample:');
    for (const m of members) {
      console.log(`  room_id=${m.room_id}  user_id=${m.user_id}  role=${m.role}`);
    }
    const uuidish = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v));
    const roomIds = [...new Set(members.map((m) => m.room_id))];
    const { data: liveRooms } = await supabase.from('rooms').select('id').in('id', roomIds);
    const liveIds = new Set((liveRooms || []).map((r) => r.id));
    const orphans = roomIds.filter((id) => !liveIds.has(id));
    console.log(`\n  referenced room_ids : ${roomIds.join(', ')}`);
    console.log(`  existing rooms      : ${[...liveIds].join(', ') || '(none)'}`);
    console.log(`  DANGLING references : ${orphans.join(', ') || '(none)'}`);
    console.log(`  user_id shape       : ${uuidish(members[0].user_id) ? 'uuid' : 'text (mismatches profiles.id uuid)'}`);
  }

  console.log('\nDone. (read-only)');
})();
