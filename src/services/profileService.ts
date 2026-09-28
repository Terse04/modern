import { Profile } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const DEFAULT_PROFILE_STATS = {
  roomsCreated: 0,
  roomsJoined: 0,
  tracksPlayed: 0,
  listeningStreakDays: 1,
  listeningHours: 0,
};

export const profileService = {
  async getProfile(username: string): Promise<Profile | null> {
    const cleanUser = username.replace(/^@/, '').toLowerCase();

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', cleanUser)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          username: data.username,
          name: data.name || data.username,
          bio: data.bio || 'Music lover listening with friends.',
          avatar:
            data.avatar ||
            'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80',
          currentStatus: data.current_status || 'Ready to listen',
          stats: data.stats || DEFAULT_PROFILE_STATS,
          favoriteTracks: [],
          recentRooms: [],
          friends: [],
        };
      }
    }

    // Check if user has local cached edits
    try {
      const cached = localStorage.getItem(`modern_profile_${cleanUser}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          id: `usr_${cleanUser}`,
          username: cleanUser,
          name: parsed.name || cleanUser,
          bio: parsed.bio || 'Music collector and listener.',
          avatar:
            parsed.avatar ||
            'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80',
          currentStatus: parsed.currentStatus || 'Ready to listen',
          stats: parsed.stats || DEFAULT_PROFILE_STATS,
          favoriteTracks: parsed.favoriteTracks || [],
          recentRooms: parsed.recentRooms || [],
          friends: parsed.friends || [],
        };
      }
    } catch { /* ignore localStorage read errors */ }

    // Return a clean default profile for any entered username
    return {
      id: `usr_${cleanUser}`,
      username: cleanUser,
      name: cleanUser.charAt(0).toUpperCase() + cleanUser.slice(1),
      bio: 'Music collector and listener.',
      avatar:
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80',
      currentStatus: 'Ready to listen',
      stats: DEFAULT_PROFILE_STATS,
      favoriteTracks: [],
      recentRooms: [],
      friends: [],
    };
  },

  async updateStatus(username: string, status: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      await supabase
        .from('profiles')
        .update({ current_status: status })
        .ilike('username', username.replace(/^@/, ''));
    }
  },

  async updateProfile(
    username: string,
    updates: Partial<Omit<Profile, 'id' | 'username'>>
  ): Promise<Profile | null> {
    const cleanUser = username.replace(/^@/, '').toLowerCase();

    if (isSupabaseConfigured && supabase) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dbUpdates: Record<string, any> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
      if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
      if (updates.currentStatus !== undefined) dbUpdates.current_status = updates.currentStatus;
      if (updates.stats !== undefined) dbUpdates.stats = updates.stats;

      const { data, error } = await supabase
        .from('profiles')
        .update(dbUpdates)
        .ilike('username', cleanUser)
        .select()
        .single();

      if (!error && data) {
        return {
          id: data.id,
          username: data.username,
          name: data.name,
          bio: data.bio,
          avatar: data.avatar,
          currentStatus: data.current_status || 'Ready to listen',
          stats: data.stats || DEFAULT_PROFILE_STATS,
          favoriteTracks: [],
          recentRooms: [],
          friends: [],
        };
      }
    }

    // LocalStorage fallback
    const current = await this.getProfile(cleanUser);
    if (!current) return null;
    const merged = { ...current, ...updates };
    try {
      localStorage.setItem(`modern_profile_${cleanUser}`, JSON.stringify(merged));
    } catch { /* ignore localStorage write errors */ }
    return merged;
  },
};
