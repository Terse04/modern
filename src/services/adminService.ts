import { User, Room, Track, PlatformSettings, VisibilityType } from '../types';
import { CURATED_OPEN_TRACKS } from './openMusicService';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const SETTINGS_STORAGE_KEY = 'modern_platform_settings';

/**
 * Escape hatch for previewing the admin dashboard with no database attached.
 *
 * Deliberately opt-in and demo-only. The previous behaviour granted admin to
 * anyone whose username was 'alex', which meant (a) the Quick Profiles picker
 * in the auth modal was a one-click admin button and (b) /admin was reachable
 * by anyone at all, since App.tsx had no route guard.
 *
 * Set VITE_DEMO_ADMIN=true in .env.local to re-enable local dashboard access.
 * It has no effect when Supabase is configured, where is_admin comes from the
 * database.
 */

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  guestDailyRoomLimit: 5,
  maxListenersPerRoom: 100,
  availableGenres: [
    'Lo-Fi / Ambient',
    'Retro Synth',
    'Downtempo',
    'Ambient Space',
    'Deep House',
    'Electronic',
    'Hip-Hop',
    'Chillwave',
    'Indie Pop',
  ],
  availableTags: [
    'Coding',
    'Lo-Fi',
    'Night',
    'Study',
    'Chill',
    'Retro',
    'Party',
    'Weekend',
    'Focus',
    'Community',
    'Experimental',
  ],
  allowedBitrates: [128, 192, 256, 320],
  allowGuestCreation: true,
  maintenanceMode: false,
};

export const adminService = {
  // ─── Platform Settings ──────────────────────────────────────────────────
  getPlatformSettings(): PlatformSettings {
    if (typeof window === 'undefined') return DEFAULT_PLATFORM_SETTINGS;
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) return { ...DEFAULT_PLATFORM_SETTINGS, ...JSON.parse(raw) };
    } catch {
      // fallback
    }
    return DEFAULT_PLATFORM_SETTINGS;
  },

  updatePlatformSettings(settings: Partial<PlatformSettings>): PlatformSettings {
    const current = this.getPlatformSettings();
    const updated = { ...current, ...settings };
    if (typeof window !== 'undefined') {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    }
    return updated;
  },

  // ─── Users Management ───────────────────────────────────────────────────
  async getAllUsers(): Promise<User[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map((p: any) => ({
          id: p.id,
          username: p.username,
          name: p.name,
          avatar: p.avatar,
          // Read straight from the server column. Previously this compared
          // `p.username === 'alex'`, which anyone could satisfy by registering
          // that username - that was the entire authorization model.
          isHost: p.role === 'host' || p.is_admin === true,
          isAdmin: p.is_admin === true,
          isBanned: p.is_banned === true,
          role: p.is_admin ? 'admin' : p.role || 'listener',
        }));
      }
    }

    return [];
  },

  async updateUser(userId: string, updates: Partial<User>): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      const payload: any = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.avatar !== undefined) payload.avatar = updates.avatar;
      if (updates.isAdmin !== undefined) payload.is_admin = updates.isAdmin;
      if (updates.isBanned !== undefined) payload.is_banned = updates.isBanned;
      if (updates.role !== undefined) payload.role = updates.role;

      const { error } = await supabase.from('profiles').update(payload).eq('id', userId);
      return !error;
    }
    return true;
  },

  async deleteUser(userId: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      return !error;
    }
    return true;
  },

  // ─── Rooms Management ───────────────────────────────────────────────────
  async getAllRooms(): Promise<Room[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('rooms')
        .select('*, host:profiles(*), current_track:tracks(*)')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map((r: any) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          artwork: r.artwork,
          host: r.host || {
            id: r.host_id || 'usr_host',
            username: 'host',
            name: 'Room Host',
            avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80',
          },
          isLive: r.is_live,
          listenerCount: r.listener_count || 1,
          currentTrackId: r.current_track_id,
          currentTrack: r.current_track,
          settings: r.settings || {
            allowChat: true,
            allowQueueAdditions: true,
            playbackPermissions: 'everyone',
            visibility: 'public',
            maxListeners: 100,
            bitrateKbps: 320,
          },
          createdAt: r.created_at,
          tags: r.tags || [],
        }));
      }
    }

    return [];
  },

  async toggleRoomLive(roomId: string, isLive: boolean): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('rooms')
        .update({ is_live: isLive })
        .eq('id', roomId);
      return !error;
    }
    return true;
  },

  async updateRoomVisibility(roomId: string, visibility: VisibilityType): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      const { data: room } = await supabase.from('rooms').select('settings').eq('id', roomId).single();
      const settings = room?.settings || {};
      settings.visibility = visibility;
      const { error } = await supabase.from('rooms').update({ settings }).eq('id', roomId);
      return !error;
    }
    return true;
  },

  async deleteRoom(roomId: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('rooms').delete().eq('id', roomId);
      return !error;
    }
    return true;
  },

  // ─── Tracks Management ──────────────────────────────────────────────────
  async getAllTracks(): Promise<Track[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('tracks').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
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
    return [...CURATED_OPEN_TRACKS];
  },

  async addTrack(track: Omit<Track, 'id'>): Promise<Track> {
    const id = `trk_${Date.now()}`;
    const newTrack: Track = { id, ...track };

    if (isSupabaseConfigured && supabase) {
      await supabase.from('tracks').insert({
        id: newTrack.id,
        title: newTrack.title,
        artist: newTrack.artist,
        album: newTrack.album,
        artwork: newTrack.artwork,
        duration: newTrack.duration,
        audio_url: newTrack.audioUrl,
        genre: newTrack.genre,
      });
    }

    return newTrack;
  },

  async deleteTrack(trackId: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('tracks').delete().eq('id', trackId);
      return !error;
    }
    return true;
  },

  // ─── Platform Analytics ─────────────────────────────────────────────────
  async getStats() {
    const [users, rooms, tracks] = await Promise.all([
      this.getAllUsers(),
      this.getAllRooms(),
      this.getAllTracks(),
    ]);

    const liveRooms = rooms.filter((r) => r.isLive);
    const totalListeners = liveRooms.reduce((sum, r) => sum + (r.listenerCount || 0), 0);

    return {
      totalUsers: users.length,
      bannedUsers: users.filter((u) => u.isBanned).length,
      adminUsers: users.filter((u) => u.isAdmin).length,
      totalRooms: rooms.length,
      liveRooms: liveRooms.length,
      totalListeners,
      totalTracks: tracks.length,
      isSupabaseLive: Boolean(isSupabaseConfigured && supabase),
    };
  },
};
