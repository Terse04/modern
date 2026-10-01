import { Track } from '../types';
import { CURATED_OPEN_TRACKS } from './openMusicService';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { storageService } from './storageService';
import { resolveStorageUrl } from '../utils/resolveStorageUrl';

export const trackService = {
  async getAvailableTracks(): Promise<Track[]> {
    const uploadedTracks = storageService.getUploadedTracks();
    const map = new Map<string, Track>();

    // 1. Add uploaded custom tracks first
    uploadedTracks.forEach((t) => map.set(t.id, t));

    const client = supabase;
    if (isSupabaseConfigured && client) {
      try {
        const { data, error } = await client.from('tracks').select('*').order('created_at', { ascending: false });
        if (!error && data) {
          // Resolve storage paths to signed URLs in parallel
          await Promise.all(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data.map(async (t: any) => {
              const audioUrl = await resolveStorageUrl(t.audio_url || '');
              const artwork = t.artwork ? await resolveStorageUrl(t.artwork) : t.artwork;
              map.set(t.id, {
                id: t.id,
                title: t.title,
                artist: t.artist,
                album: t.album,
                artwork,
                duration: t.duration,
                audioUrl,
                genre: t.genre,
              });
            })
          );
        }
      } catch (err) {
        console.warn('[trackService] Supabase tracks fetch failed, using fallback:', err);
      }
    }

    // 3. Fallback to curated open-source tracks
    CURATED_OPEN_TRACKS.forEach((t) => {
      if (!map.has(t.id)) {
        map.set(t.id, t);
      }
    });

    return Array.from(map.values());
  },

  async getTrackById(id: string): Promise<Track | null> {
    const uploaded = storageService.getUploadedTracks().find((t) => t.id === id);
    if (uploaded) return uploaded;

    const client = supabase;
    if (isSupabaseConfigured && client) {
      try {
        const { data, error } = await client.from('tracks').select('*').eq('id', id).single();
        if (!error && data) {
          const audioUrl = await resolveStorageUrl(data.audio_url || '');
          const artwork = data.artwork ? await resolveStorageUrl(data.artwork) : data.artwork;
          return {
            id: data.id,
            title: data.title,
            artist: data.artist,
            album: data.album,
            artwork,
            duration: data.duration,
            audioUrl,
            genre: data.genre,
          };
        }
      } catch { /* ignore – fall back to curated list */ }
    }
    return CURATED_OPEN_TRACKS.find((t) => t.id === id) || null;
  },

  async searchTracks(query: string): Promise<Track[]> {
    const all = await this.getAvailableTracks();
    const q = query.toLowerCase().trim();
    if (!q) return all;
    return all.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album?.toLowerCase().includes(q) ||
        t.genre?.toLowerCase().includes(q)
    );
  },
};
