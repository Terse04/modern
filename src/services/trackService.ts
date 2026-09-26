import { Track } from '../types';
import { DEMO_TRACKS } from '../data/mockData';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export const trackService = {
  async getAvailableTracks(): Promise<Track[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('tracks').select('*').order('title');
      if (!error && data) {
        return data.map((t: any) => ({
          id: t.id,
          title: t.title,
          artist: t.artist,
          album: t.album,
          artwork: t.artwork,
          duration: t.duration,
          audioUrl: t.audio_url,
          genre: t.genre,
        }));
      }
    }
    return [...DEMO_TRACKS];
  },

  async getTrackById(id: string): Promise<Track | null> {
    if (isSupabaseConfigured && supabase) {
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
    }
    return DEMO_TRACKS.find((t) => t.id === id) || null;
  },

  async searchTracks(query: string): Promise<Track[]> {
    const q = query.toLowerCase().trim();
    if (!q) return [...DEMO_TRACKS];
    return DEMO_TRACKS.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q) ||
        t.genre?.toLowerCase().includes(q)
    );
  },
};
