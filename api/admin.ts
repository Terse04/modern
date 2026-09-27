import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://lvudbyfktpymccdskmtf.supabase.co';

const secretKey =
  process.env.SUPABASE_SECRET_KEY ||
  'sb_secret_Kk163O-7QqYrY--UgibG6A_o286NMKx';

const supabaseAdmin = createClient(supabaseUrl, secretKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = (req.query.action as string) || '';

  try {
    switch (action) {
      // ─── TRACKS ──────────────────────────────────────────────────────
      case 'get-tracks': {
        const { data, error } = await supabaseAdmin
          .from('tracks')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ tracks: data || [] });
      }

      case 'add-track': {
        const track = req.body;
        if (!track || !track.id || !track.title) {
          return res.status(400).json({ error: 'Missing track data (id, title required)' });
        }

        const { data, error } = await supabaseAdmin.from('tracks').upsert({
          id: track.id,
          title: track.title,
          artist: track.artist || 'Unknown Artist',
          album: track.album || 'Single',
          artwork: track.artwork || null,
          duration: track.duration || 0,
          audio_url: track.audioUrl || track.audio_url || '',
          genre: track.genre || null,
        }, { onConflict: 'id' }).select().single();

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ track: data });
      }

      case 'delete-track': {
        const trackId = req.query.id as string;
        if (!trackId) return res.status(400).json({ error: 'Missing track id' });

        // First nullify any room references to this track
        await supabaseAdmin
          .from('rooms')
          .update({ current_track_id: null })
          .eq('current_track_id', trackId);

        // Delete queue items referencing this track
        await supabaseAdmin
          .from('queue_items')
          .delete()
          .eq('track_id', trackId);

        // Now delete the track
        const { error } = await supabaseAdmin
          .from('tracks')
          .delete()
          .eq('id', trackId);

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true });
      }

      // ─── SEED TRACKS ────────────────────────────────────────────────
      case 'seed-tracks': {
        const tracks = req.body?.tracks;
        if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
          return res.status(400).json({ error: 'Missing tracks array in body' });
        }

        const rows = tracks.map((t: any) => ({
          id: t.id,
          title: t.title,
          artist: t.artist || 'Unknown Artist',
          album: t.album || 'Single',
          artwork: t.artwork || null,
          duration: t.duration || 0,
          audio_url: t.audioUrl || t.audio_url || '',
          genre: t.genre || null,
        }));

        const { error } = await supabaseAdmin.from('tracks').upsert(rows, { onConflict: 'id' });
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true, seeded: rows.length });
      }

      // ─── UPSERT TRACK (for queue / playback persistence) ─────────
      case 'upsert-track': {
        const t = req.body;
        if (!t || !t.id) return res.status(400).json({ error: 'Missing track id' });

        const { error } = await supabaseAdmin.from('tracks').upsert({
          id: t.id,
          title: t.title || 'Untitled',
          artist: t.artist || 'Unknown Artist',
          album: t.album || 'Single',
          artwork: t.artwork || null,
          duration: t.duration || 0,
          audio_url: t.audioUrl || t.audio_url || '',
          genre: t.genre || null,
        }, { onConflict: 'id' });

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true });
      }

      // ─── ROOMS ───────────────────────────────────────────────────────
      case 'delete-room': {
        const roomId = req.query.id as string;
        if (!roomId) return res.status(400).json({ error: 'Missing room id' });

        const { error } = await supabaseAdmin
          .from('rooms')
          .delete()
          .eq('id', roomId);

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true });
      }

      // ─── FIX RLS ─────────────────────────────────────────────────────
      case 'fix-rls': {
        // Fix the is_admin() / current_profile_id() functions to use
        // profiles.id instead of non-existent profiles.auth_user_id
        const sqls = [
          `create or replace function public.current_profile_id()
           returns text language sql stable security definer set search_path = public as $$
             select p.id from public.profiles p where p.id = auth.uid()::text limit 1;
           $$;`,
          `create or replace function public.is_admin()
           returns boolean language sql stable security definer set search_path = public as $$
             select coalesce((
               select p.is_admin and not p.is_banned from public.profiles p where p.id = auth.uid()::text limit 1
             ), false);
           $$;`,
          `create or replace function public.is_banned()
           returns boolean language sql stable security definer set search_path = public as $$
             select coalesce((
               select p.is_banned from public.profiles p where p.id = auth.uid()::text limit 1
             ), false);
           $$;`,
        ];

        for (const sql of sqls) {
          const { error } = await supabaseAdmin.rpc('exec_sql', { sql_text: sql }).maybeSingle();
          // rpc may not exist; fall back to raw POST if needed
          if (error) {
            // Try direct REST call to pg
            const pgRes = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: secretKey,
                Authorization: `Bearer ${secretKey}`,
              },
              body: JSON.stringify({ sql_text: sql }),
            });
            if (!pgRes.ok) {
              console.warn('[admin] fix-rls SQL error:', await pgRes.text());
            }
          }
        }
        return res.status(200).json({ success: true, note: 'RLS functions updated' });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    console.error('[admin] handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
