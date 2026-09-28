import { Track } from '../types';
import { CURATED_OPEN_TRACKS } from './openMusicService';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { storageService } from './storageService';

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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.forEach((t: any) => {
            let audioUrl = t.audio_url || '';
            if (audioUrl && !audioUrl.startsWith('http') && !audioUrl.startsWith('blob:') && !audioUrl.startsWith('data:')) {
              const { data: pubData } = client.storage.from('tracks').getPublicUrl(audioUrl);
              if (pubData?.publicUrl) audioUrl = pubData.publicUrl;
            }
            map.set(t.id, {
              id: t.id,
              title: t.title,
              artist: t.artist,
              album: t.album,
              artwork: t.artwork,
              duration: t.duration,
              audioUrl,
              genre: t.genre,
            });
          });
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
          let audioUrl = data.audio_url || '';
          if (audioUrl && !audioUrl.startsWith('http') && !audioUrl.startsWith('blob:') && !audioUrl.startsWith('data:')) {
            const { data: pubData } = client.storage.from('tracks').getPublicUrl(audioUrl);
            if (pubData?.publicUrl) audioUrl = pubData.publicUrl;
          }
          return {
            id: data.id,
            title: data.title,
            artist: data.artist,
            album: data.album,
            artwork: data.artwork,
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
