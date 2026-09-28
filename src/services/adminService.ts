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
  async getPlatformSettings(): Promise<PlatformSettings> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('platform_settings').select('*').eq('id', 1).single();
      if (!error && data) {
        return {
          guestDailyRoomLimit: data.guest_daily_room_limit,
          maxListenersPerRoom: data.max_listeners_per_room,
          availableGenres: data.available_genres,
          availableTags: data.available_tags,
          allowedBitrates: data.allowed_bitrates,
          allowGuestCreation: data.allow_guest_creation,
          maintenanceMode: data.maintenance_mode,
        };
      }
    }
    
    // Fallback to local storage for demo
    if (typeof window === 'undefined') return DEFAULT_PLATFORM_SETTINGS;
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) return { ...DEFAULT_PLATFORM_SETTINGS, ...JSON.parse(raw) };
    } catch {
      // fallback
    }
    return DEFAULT_PLATFORM_SETTINGS;
  },

  async updatePlatformSettings(settings: Partial<PlatformSettings>): Promise<PlatformSettings> {
    const current = await this.getPlatformSettings();
    const updated = { ...current, ...settings };

    if (isSupabaseConfigured && supabase) {
      const payload = {
        guest_daily_room_limit: updated.guestDailyRoomLimit,
        max_listeners_per_room: updated.maxListenersPerRoom,
        available_genres: updated.availableGenres,
        available_tags: updated.availableTags,
        allowed_bitrates: updated.allowedBitrates,
        allow_guest_creation: updated.allowGuestCreation,
        maintenance_mode: updated.maintenanceMode,
      };
      
      const { error } = await supabase.from('platform_settings').update(payload).eq('id', 1);
      if (error) {
        console.error('Failed to update platform settings in DB:', error);
      }
    }

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      const { error } = await supabase.rpc('admin_set_user_flags', {
        p_user_id: userId,
        p_is_banned: updates.isBanned !== undefined ? updates.isBanned : null,
        p_role: updates.role !== undefined ? updates.role : null,
        p_is_admin: updates.isAdmin !== undefined ? updates.isAdmin : null
      });

      if (error) {
        console.error('[adminService] updateUser rpc error:', error);
        throw new Error(error.message);
      }
      return true;
    }
    return true;
  },

  async deleteUser(userId: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      const { error, data } = await supabase.from('profiles').delete().eq('id', userId).select();
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error('User not found or permission denied');
      return true;
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      const { error, data } = await supabase
        .from('rooms')
        .update({ is_live: isLive })
        .eq('id', roomId)
        .select();
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error('Room not found or permission denied');
      return true;
    }
    return true;
  },

  async updateRoomVisibility(roomId: string, visibility: VisibilityType): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      const { data: room, error: fetchErr } = await supabase.from('rooms').select('settings').eq('id', roomId).single();
      if (fetchErr) throw new Error(fetchErr.message);
      const settings = room?.settings || {};
      settings.visibility = visibility;
      const { error, data } = await supabase.from('rooms').update({ settings }).eq('id', roomId).select();
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error('Room not found or permission denied');
      return true;
    }
    return true;
  },

  async deleteRoom(roomId: string): Promise<boolean> {
    // Primary: use admin API (bypasses RLS)
    try {
      const res = await fetch(`/api/admin?action=delete-room&id=${encodeURIComponent(roomId)}`, {
        method: 'DELETE',
      });
      if (res.ok) return true;
    } catch {
      // fall through
    }

    // Fallback: direct Supabase delete
    if (isSupabaseConfigured && supabase) {
      const { error, data } = await supabase.from('rooms').delete().eq('id', roomId).select();
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error('Room not found or permission denied');
      return true;
    }
    return true;
  },

  // ─── Tracks Management ──────────────────────────────────────────────────
  async getAllTracks(): Promise<Track[]> {
    const client = supabase;
    if (isSupabaseConfigured && client) {
      try {
        const { data, error } = await client.from('tracks').select('*').order('created_at', { ascending: false });
        if (!error && data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return data.map((t: any) => {
            let audioUrl = t.audio_url || '';
            if (audioUrl && !audioUrl.startsWith('http') && !audioUrl.startsWith('blob:') && !audioUrl.startsWith('data:')) {
              const { data: pubData } = client.storage.from('tracks').getPublicUrl(audioUrl);
              if (pubData?.publicUrl) audioUrl = pubData.publicUrl;
            }
            return {
              id: t.id,
              title: t.title,
              artist: t.artist,
              album: t.album,
              artwork: t.artwork,
              duration: t.duration,
              audioUrl,
              genre: t.genre,
            };
          });
        }
      } catch (err) {
        console.warn('[adminService] Failed to load tracks from Supabase:', err);
      }
    }

    return [];
  },

  async addTrack(track: Omit<Track, 'id'>): Promise<Track> {
    const id = `trk_${Date.now()}`;
    const newTrack: Track = { id, ...track };

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('tracks').insert({
        id: newTrack.id,
        title: newTrack.title,
        artist: newTrack.artist,
        album: newTrack.album,
        artwork: newTrack.artwork,
        duration: Math.max(1, Math.round(newTrack.duration)),
        audio_url: newTrack.audioUrl,
        genre: newTrack.genre,
      });
      if (error) {
        console.error('[adminService] Failed to insert track:', error);
        throw new Error(error.message);
      }
    }

    return newTrack;
  },

  async deleteTrack(trackId: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      // Clean up any queue items referencing this track first to maintain integrity
      await supabase.from('queue_items').delete().eq('track_id', trackId);
      const { error } = await supabase.from('tracks').delete().eq('id', trackId);
      if (error) throw new Error(error.message);
      return true;
    }
    return true;
  },

  /**
   * Seed curated open-source tracks into the database so they are real
   * persistent rows. Only needs to be called once; subsequent calls are
   * idempotent (upsert on id).
   */
  async seedCuratedTracks(): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      try {
        const rows = CURATED_OPEN_TRACKS.map((t) => ({
          id: t.id,
          title: t.title,
          artist: t.artist,
          album: t.album,
          artwork: t.artwork,
          duration: Math.max(1, Math.round(t.duration)),
          audio_url: t.audioUrl,
          genre: t.genre,
        }));
        const { error } = await supabase.from('tracks').upsert(rows, { onConflict: 'id' });
        if (!error) return true;
        console.warn('[adminService] seedCuratedTracks error:', error);
      } catch (err) {
        console.warn('[adminService] seedCuratedTracks exception:', err);
      }
    }
    return false;
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
