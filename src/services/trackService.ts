import { Track } from '../types';
import { DEMO_TRACKS } from '../data/mockData';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { storageService } from './storageService';

export const trackService = {
  async getAvailableTracks(): Promise<Track[]> {
    const uploadedTracks = storageService.getUploadedTracks();
    const map = new Map<string, Track>();

    // 1. Add uploaded custom tracks first
    uploadedTracks.forEach((t) => map.set(t.id, t));

    // 2. Fetch Supabase tracks if configured
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('tracks').select('*').order('created_at', { ascending: false });
        if (!error && data) {
          data.forEach((t: any) => {
            map.set(t.id, {
              id: t.id,
              title: t.title,
              artist: t.artist,
              album: t.album,
              artwork: t.artwork,
              duration: t.duration,
              audioUrl: t.audio_url,
              genre: t.genre,
            });
          });
        }
      } catch (err) {
        console.warn('[trackService] Supabase tracks fetch failed, using fallback:', err);
      }
    }

    // 3. Fallback demo tracks if empty or as starters
    DEMO_TRACKS.forEach((t) => {
      if (!map.has(t.id)) {
        map.set(t.id, t);
      }
    });

    return Array.from(map.values());
  },

  async getTrackById(id: string): Promise<Track | null> {
    const uploaded = storageService.getUploadedTracks().find((t) => t.id === id);
    if (uploaded) return uploaded;

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('tracks').select('*').eq('id', id).single();
        if (!error && data) {
          return {
            id: data.id,
            title: data.title,
            artist: data.artist,
            album: data.album,
            artwork: data.artwork,
            duration: data.duration,
            audioUrl: data.audio_url,
            genre: data.genre,
          };
        }
      } catch (_) {}
    }
    return DEMO_TRACKS.find((t) => t.id === id) || null;
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
