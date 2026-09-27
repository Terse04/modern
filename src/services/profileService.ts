import { Profile } from '../types';
import { DEMO_PROFILE, DEMO_USERS } from '../data/mockData';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export const profileService = {
  async getProfile(username: string): Promise<Profile | null> {
    const cleanUser = username.replace(/^@/, '').toLowerCase();

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', cleanUser)
        .single();

      if (!error && data) {
        return {
          id: data.id,
          username: data.username,
          name: data.name,
          bio: data.bio,
          avatar: data.avatar,
          currentStatus: data.current_status || 'Listening with friends',
          stats: data.stats || DEMO_PROFILE.stats,
          favoriteTracks: DEMO_PROFILE.favoriteTracks,
          recentRooms: DEMO_PROFILE.recentRooms,
          friends: DEMO_PROFILE.friends,
        };
      }
    }

    // Check if user has local cached edits
    try {
      const cached = localStorage.getItem(`modern_profile_${cleanUser}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          ...DEMO_PROFILE,
          ...parsed,
          username: cleanUser,
        };
      }
    } catch (_) {}

    if (cleanUser === 'alex' || cleanUser === 'me') {
      return DEMO_PROFILE;
    }

    const matchedUser = DEMO_USERS[cleanUser];
    if (matchedUser) {
      return {
        id: matchedUser.id,
        username: matchedUser.username,
        name: matchedUser.name,
        bio: 'Music enthusiast exploring shared soundscapes.',
        avatar: matchedUser.avatar,
        currentStatus: 'Listening in Late Night Coding',
        stats: {
          roomsCreated: 14,
          roomsJoined: 89,
          tracksPlayed: 432,
          listeningStreakDays: 6,
          listeningHours: 92,
        },
        favoriteTracks: DEMO_PROFILE.favoriteTracks.slice(0, 2),
        recentRooms: DEMO_PROFILE.recentRooms.slice(0, 2),
        friends: DEMO_PROFILE.friends.slice(0, 3),
      };
    }

    // Return a default profile for any entered username
    return {
      id: `usr_${cleanUser}`,
      username: cleanUser,
      name: cleanUser.charAt(0).toUpperCase() + cleanUser.slice(1),
      bio: 'Music collector and listener.',
      avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80`,
      currentStatus: 'Ready to listen',
      stats: {
        roomsCreated: 3,
        roomsJoined: 28,
        tracksPlayed: 115,
        listeningStreakDays: 2,
        listeningHours: 24,
      },
      favoriteTracks: DEMO_PROFILE.favoriteTracks.slice(0, 2),
      recentRooms: DEMO_PROFILE.recentRooms.slice(0, 1),
      friends: DEMO_PROFILE.friends.slice(0, 2),
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
    userIdOrUsername: string,
    updates: {
      name?: string;
      bio?: string;
      avatar?: string;
      currentStatus?: string;
    }
  ): Promise<void> {
    const cleanUser = userIdOrUsername.replace(/^@/, '').toLowerCase();

    if (isSupabaseConfigured && supabase) {
      const payload: Record<string, any> = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.bio !== undefined) payload.bio = updates.bio;
      if (updates.avatar !== undefined) payload.avatar = updates.avatar;
      if (updates.currentStatus !== undefined) payload.current_status = updates.currentStatus;

      try {
        await supabase
          .from('profiles')
          .update(payload)
          .or(`id.eq.${userIdOrUsername},username.ilike.${cleanUser}`);
      } catch (err) {
        console.warn('[ProfileService] Supabase profile update error:', err);
      }
    }

    // Persist to local cache for resilience
    try {
      const cachedKey = `modern_profile_${cleanUser}`;
      const existing = localStorage.getItem(cachedKey);
      const base = existing ? JSON.parse(existing) : (cleanUser === 'alex' ? DEMO_PROFILE : {});
      localStorage.setItem(
        cachedKey,
        JSON.stringify({
          ...base,
          ...updates,
          username: cleanUser,
        })
      );
    } catch (e) {
      console.warn('[ProfileService] Local storage update failed:', e);
    }
  },
};
