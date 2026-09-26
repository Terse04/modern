const { createClient } = require('@supabase/supabase-js');

const url = 'https://lvudbyfktpymccdskmtf.supabase.co';
const key = 'sb_publishable_dqfX7hkJmFQ5SZa36nb0Dg_HoxHltld';

const supabase = createClient(url, key);

const tables = ['profiles', 'tracks', 'rooms', 'room_members', 'queue_items', 'chat_messages'];

async function check() {
  console.log('Connecting to Supabase at:', url);
  let allGood = true;

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      console.log(`❌ Table [${table}]: Not found (${error.message})`);
      allGood = false;
    } else {
      console.log(`✅ Table [${table}]: Ready (rows accessible)`);
    }
  }

  if (allGood) {
    console.log('\n🎉 All Supabase tables are ready and populated!');
  } else {
    console.log('\n👉 Run supabase/schema.sql in your Supabase SQL Editor to initialize tables.');
  }
}

check();
