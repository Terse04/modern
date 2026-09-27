/**
 * READ-ONLY Supabase schema introspection.
 *
 * Answers the question: which of the three competing schema files actually won?
 * (supabase/schema.sql, supabase/migrations/001_initial_schema.sql,
 *  supabase/admin_migration.sql)
 *
 * This script performs SELECT queries ONLY. It never inserts, updates or
 * deletes. Postgres error messages are used to probe for table/column
 * existence, which is why some probes deliberately reference columns that
 * may not exist.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// ─── Load .env without a dependency ────────────────────────────────────────
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

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, key);
console.log(`Target: ${url.replace(/https:\/\/([^.]+)\..*/, '$1...')}\n`);

const TABLES = [
  'profiles',
  'tracks',
  'rooms',
  'room_members',
  'queue_items',
  'chat_messages',
  'guest_creations',
  'platform_settings',
];

async function probeTable(name) {
  const { data, error } = await supabase.from(name).select('*').limit(1);
  if (error) {
    const msg = error.message || String(error);
    if (/does not exist|not found|schema cache/i.test(msg)) {
      return { exists: false, reason: 'table does not exist' };
    }
    return { exists: 'unknown', reason: msg, data };
  }
  const columns = data && data.length ? Object.keys(data[0]) : [];
  return { exists: true, columns, sample: data && data[0] ? data[0] : null };
}

async function countRows(name) {
  const { count, error } = await supabase
    .from(name)
    .select('*', { count: 'exact', head: true });
  if (error) return `err: ${error.message}`;
  return count;
}

(async () => {
  const report = {};

  for (const t of TABLES) {
    const r = await probeTable(t);
    if (r.exists === true) {
      report[t] = { exists: true, columns: r.columns, rows: await countRows(t) };
    } else {
      report[t] = { exists: r.exists === false ? false : 'unknown', reason: r.reason };
    }
  }

  console.log('='.repeat(72));
  console.log('TABLE INVENTORY');
  console.log('='.repeat(72));
  for (const [name, info] of Object.entries(report)) {
    if (info.exists === true) {
      console.log(`\n[OK]   ${name}  (${info.rows} rows)`);
      console.log(`       columns: ${info.columns.join(', ')}`);
    } else {
      console.log(`\n[--]   ${name}  -> ${info.reason}`);
    }
  }

  // ─── Distinguish the platform_settings variants ───────────────────────────
  // v1 (admin_migration.sql): id text PK default 'global', settings jsonb
  // v2 (001_initial_schema):  id integer PK default 1, flat columns
  const ps = report.platform_settings;
  if (ps.exists === true) {
    console.log('\n' + '='.repeat(72));
    console.log('platform_settings VARIANT');
    console.log('='.repeat(72));
    if (ps.columns.includes('settings')) {
      console.log("MATCHES admin_migration.sql  (id text 'global' + settings jsonb)");
    } else {
      console.log("MATCHES 001_initial_schema.sql (id integer, flat columns)");
    }
  }

  // ─── Distinguish profiles id type: text seed ids vs uuid auth ids ─────────
  const pr = report.profiles;
  if (pr.exists === true) {
    console.log('\n' + '='.repeat(72));
    console.log('profiles.id VALUE SHAPE');
    console.log('='.repeat(72));
    const { data } = await supabase.from('profiles').select('id, username').limit(5);
    if (data && data.length) {
      const looksUuid = data.every(
        (r) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(r.id))
      );
      console.log('sample ids:', data.map((r) => `${r.username}=${r.id}`).join(', '));
      console.log(looksUuid
        ? '-> UUID ids: matches 001_initial_schema.sql (bound to auth.users)'
        : '-> text seed ids: matches schema.sql (standalone text PK)');
    } else {
      console.log('profiles table is empty - cannot infer id type from data.');
      console.log('Check the DDL in the Supabase dashboard if ambiguous.');
    }
  }

  // ─── Whether seeded demo data (schema.sql) is present ────────────────────
  console.log('\n' + '='.repeat(72));
  console.log('SEED DATA (schema.sql inserts these)');
  console.log('='.repeat(72));
  const { data: seededRooms } = await supabase
    .from('rooms')
    .select('id, name')
    .in('id', ['late-night-coding', '2000s-nostalgia', 'friday-night', 'lo-fi-study']);
  console.log(seededRooms && seededRooms.length
    ? `seed rooms present: ${seededRooms.map((r) => r.id).join(', ')}  -> schema.sql was applied`
    : 'no seed rooms      -> schema.sql seed block was NOT applied');

  console.log('\nDone. (read-only: no writes were performed)');
})();
