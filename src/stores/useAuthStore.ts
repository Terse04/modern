import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { User } from '../types';
import { CURRENT_USER, DEMO_USERS } from '../data/mockData';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const STORAGE_KEY = 'modern_active_user';

interface AuthState {
  currentUser: User;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;

  // Actions
  initAuth: () => () => void;
  switchProfile: (user: User) => void;
  createGuestProfile: (name: string, username: string) => User;
  signUpWithEmail: (email: string, password: string, name: string, username: string) => Promise<{ error?: string }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signInWithOtp: (email: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

function getStoredUser(): User {
  if (typeof window === 'undefined') return CURRENT_USER;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse stored user:', err);
  }
  return CURRENT_USER;
}

function saveStoredUser(user: User) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch (err) {
    console.warn('Failed to save stored user:', err);
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  currentUser: getStoredUser(),
  session: null,
  isAuthenticated: false,
  isLoading: true,
  authError: null,

  initAuth: () => {
    const client = supabase;
    if (!isSupabaseConfigured || !client) {
      set({ isLoading: false });
      return () => {};
    }

    // 1. Get initial session
    client.auth.getSession().then(({ data: { session }, error }) => {
      if (!error && session?.user) {
        // Fetch or create profile
        client
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile }) => {
            if (profile) {
              const user: User = {
                id: profile.id,
                username: profile.username,
                name: profile.name,
                avatar: profile.avatar,
              };
              saveStoredUser(user);
              set({ currentUser: user, session, isAuthenticated: true, isLoading: false });
            } else {
              // Create profile from user metadata if missing
              const meta = session.user.user_metadata || {};
              const defaultName = meta.name || session.user.email?.split('@')[0] || 'Listener';
              const defaultUsername = meta.username || session.user.email?.split('@')[0] || `user_${session.user.id.slice(0, 5)}`;
              const defaultAvatar = meta.avatar_url || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80`;

              client
                .from('profiles')
                .insert({
                  id: session.user.id,
                  username: defaultUsername,
                  name: defaultName,
                  avatar: defaultAvatar,
                })
                .then(() => {
                  const user: User = {
                    id: session.user.id,
                    username: defaultUsername,
                    name: defaultName,
                    avatar: defaultAvatar,
                  };
                  saveStoredUser(user);
                  set({ currentUser: user, session, isAuthenticated: true, isLoading: false });
                });
            }
          });
      } else {
        set({ session: null, isAuthenticated: false, isLoading: false });
      }
    });

    // 2. Listen to auth changes
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const { data: profile } = await client
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          const user: User = {
            id: profile.id,
            username: profile.username,
            name: profile.name,
            avatar: profile.avatar,
          };
          saveStoredUser(user);
          set({ currentUser: user, session, isAuthenticated: true, isLoading: false });
        }
      } else {
        set({ session: null, isAuthenticated: false, isLoading: false });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  },

  switchProfile: (user: User) => {
    saveStoredUser(user);
    set({ currentUser: user, authError: null });
  },

  createGuestProfile: (name: string, username: string) => {
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || `guest_${Date.now().toString(36)}`;
    const cleanName = name.trim() || 'Guest Listener';
    const avatars = [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=300&q=80',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
    ];
    const avatar = avatars[Math.floor(Math.random() * avatars.length)];

    const newUser: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      username: cleanUsername,
      name: cleanName,
      avatar,
    };

    saveStoredUser(newUser);
    set({ currentUser: newUser, authError: null });

    // Try to sync profile to Supabase if configured
    if (isSupabaseConfigured && supabase) {
      supabase.from('profiles').upsert({
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        avatar: newUser.avatar,
        current_status: 'Listening as Guest',
      }).then(() => {});
    }

    return newUser;
  },

  signUpWithEmail: async (email, password, name, username) => {
    if (!isSupabaseConfigured || !supabase) {
      return { error: 'Supabase is not configured yet.' };
    }
    set({ isLoading: true, authError: null });

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const cleanName = name.trim() || cleanUsername;
    const defaultAvatar = `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: cleanName,
          username: cleanUsername,
          avatar_url: defaultAvatar,
        },
      },
    });

    if (error) {
      set({ isLoading: false, authError: error.message });
      return { error: error.message };
    }

    if (data.user) {
      // Upsert profile
      await supabase.from('profiles').upsert({
        id: data.user.id,
        username: cleanUsername,
        name: cleanName,
        avatar: defaultAvatar,
      });

      const newUser: User = {
        id: data.user.id,
        username: cleanUsername,
        name: cleanName,
        avatar: defaultAvatar,
      };
      saveStoredUser(newUser);
      set({ currentUser: newUser, session: data.session, isAuthenticated: true, isLoading: false });
    }

    return {};
  },

  signInWithEmail: async (email, password) => {
    if (!isSupabaseConfigured || !supabase) {
      return { error: 'Supabase is not configured yet.' };
    }
    set({ isLoading: true, authError: null });

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      set({ isLoading: false, authError: error.message });
      return { error: error.message };
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profile) {
        const user: User = {
          id: profile.id,
          username: profile.username,
          name: profile.name,
          avatar: profile.avatar,
        };
        saveStoredUser(user);
        set({ currentUser: user, session: data.session, isAuthenticated: true, isLoading: false });
      }
    }

    return {};
  },

  signInWithOtp: async (email) => {
    if (!isSupabaseConfigured || !supabase) {
      return { error: 'Supabase is not configured yet.' };
    }
    set({ isLoading: true, authError: null });

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    set({ isLoading: false });
    if (error) {
      set({ authError: error.message });
      return { error: error.message };
    }

    return {};
  },

  signOut: async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    // Revert to demo Alex profile
    saveStoredUser(DEMO_USERS.alex);
    set({
      currentUser: DEMO_USERS.alex,
      session: null,
      isAuthenticated: false,
      authError: null,
    });
  },

  clearError: () => set({ authError: null }),
}));
