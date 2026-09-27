import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { User } from '../types';
import { CURRENT_USER } from '../data/mockData';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const STORAGE_KEY = 'modern_active_user';

/**
 * The identity we fall back to whenever nobody is signed in.
 *
 * This used to be DEMO_USERS.alex, which carried isHost: true and, because
 * adminService derived `isAdmin` from `username === 'alex'`, silently granted
 * admin to anyone who signed out. An anonymous visitor gets a neutral,
 * privilege-free guest instead.
 */
const ANONYMOUS_GUEST: User = {
  id: 'usr_anonymous',
  username: 'guest',
  name: 'Guest Listener',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80',
  isHost: false,
  isAdmin: false,
  role: 'listener',
};

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

/**
 * profiles.id is TEXT (guests need non-uuid ids) and links to auth.users via
 * the separate auth_user_id UUID column. So every lookup for a signed-in user
 * must filter on auth_user_id, never on id.
 *
 * isAdmin / isBanned are read from the server row. They are deliberately NOT
 * trusted from localStorage, and there is no username comparison anywhere -
 * `username === 'alex'` was the previous check and anyone could satisfy it by
 * registering that name.
 */
function mapProfile(row: any): User {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    avatar: row.avatar,
    isAdmin: row.is_admin === true,
    isBanned: row.is_banned === true,
    role: row.role || 'listener',
  };
}

async function fetchProfileByAuthUser(
  client: NonNullable<typeof supabase>,
  authUserId: string
): Promise<User | null> {
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (error) {
    console.warn('[Auth] profile lookup failed:', error.message);
    return null;
  }
  return data ? mapProfile(data) : null;
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
    client.auth.getSession().then(async ({ data: { session }, error }) => {
      if (!error && session?.user) {
        // The handle_new_user() trigger in 20260927000300 creates this row on
        // auth.users insert, so it should always exist by the time we get here.
        const user = await fetchProfileByAuthUser(client, session.user.id);

        if (user) {
          saveStoredUser(user);
          set({ currentUser: user, session, isAuthenticated: true, isLoading: false });
        } else {
          // Trigger missing or profile deleted. Fall back to a minimal identity
          // derived from the verified session rather than writing a profile
          // ourselves - the trigger is the only writer of auth_user_id.
          const meta = session.user.user_metadata || {};
          const fallback: User = {
            id: `usr_${session.user.id.slice(0, 12)}`,
            username: meta.username || session.user.email?.split('@')[0] || 'listener',
            name: meta.name || session.user.email?.split('@')[0] || 'Listener',
            avatar:
              meta.avatar_url ||
              'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80',
          };
          saveStoredUser(fallback);
          set({ currentUser: fallback, session, isAuthenticated: true, isLoading: false });
        }
      } else {
        set({ session: null, isAuthenticated: false, isLoading: false });
      }
    });

    // 2. Listen to auth changes
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      // NOTE: do not await Supabase queries inside this callback. The SDK
      // serialises it against its own client and awaiting here is a documented
      // deadlock hazard. Defer to a microtask instead.
      void (async () => {
        if (session?.user) {
          const user = await fetchProfileByAuthUser(client, session.user.id);
          if (user) {
            saveStoredUser(user);
            set({ currentUser: user, session, isAuthenticated: true, isLoading: false });
          }
        } else {
          set({ session: null, isAuthenticated: false, isLoading: false });
        }
      })();
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
    const baseUsername =
      username
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .replace(/^_+|_+$/g, '')
        .slice(0, 24) || `guest_${Math.random().toString(36).slice(2, 8)}`;
    const cleanName = name.trim().slice(0, 60) || 'Guest Listener';

    const newUser: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      // The profiles table enforces ^[a-z0-9_]{2,32}$. Pad short names so the
      // insert cannot fail the CHECK constraint.
      username: baseUsername.length >= 2 ? baseUsername : baseUsername.padEnd(2, '0'),
      name: cleanName,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80',
    };

    saveStoredUser(newUser);
    set({ currentUser: newUser, authError: null });

    // Best-effort sync. auth_user_id stays NULL, which the profiles INSERT
    // policy permits for guests. A username collision is retried once with a
    // random suffix, since the column is UNIQUE.
    if (isSupabaseConfigured && supabase) {
      void (async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
          const candidate =
            attempt === 0
              ? newUser.username
              : `${newUser.username.slice(0, 20)}_${Math.random().toString(36).slice(2, 6)}`;

          const { error } = await supabase.from('profiles').insert({
            id: newUser.id,
            username: candidate,
            name: newUser.name,
            avatar: newUser.avatar,
            current_status: 'Listening as Guest',
          });

          if (!error) {
            if (candidate !== newUser.username) {
              newUser.username = candidate;
              saveStoredUser(newUser);
              set({ currentUser: newUser });
            }
            return;
          }
          if (error.code !== '23505') {
            console.warn('[Auth] guest profile sync failed:', error.message);
            return;
          }
        }
        console.warn('[Auth] guest profile sync skipped: username already taken');
      })();
    }

    return newUser;
  },

  signUpWithEmail: async (email, password, name, username) => {
    if (!isSupabaseConfigured || !supabase) {
      return { error: 'Supabase is not configured yet.' };
    }
    set({ isLoading: true, authError: null });

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
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

    if (!data.user) {
      set({ isLoading: false });
      return { error: 'Sign up did not return a user.' };
    }

    // No profiles insert here. The handle_new_user() trigger creates the row
    // and owns auth_user_id; writing it from the client would be an
    // unauthenticated write to a table we now lock down.
    const profile = await fetchProfileByAuthUser(supabase, data.user.id);

    if (!data.session) {
      // Email confirmation is enabled. The account exists but is not usable
      // until the link is clicked.
      set({ isLoading: false });
      return { error: 'Check your email to confirm your account, then sign in.' };
    }

    const user: User = profile || {
      id: `usr_${data.user.id.slice(0, 12)}`,
      username: cleanUsername,
      name: cleanName,
      avatar: defaultAvatar,
    };
    saveStoredUser(user);
    set({ currentUser: user, session: data.session, isAuthenticated: true, isLoading: false });

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
      const user = await fetchProfileByAuthUser(supabase, data.user.id);
      if (user) {
        saveStoredUser(user);
        set({ currentUser: user, session: data.session, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
        return { error: 'Signed in, but no profile row exists. Try signing up again.' };
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
    saveStoredUser(ANONYMOUS_GUEST);
    set({
      currentUser: ANONYMOUS_GUEST,
      session: null,
      isAuthenticated: false,
      authError: null,
    });
  },

  clearError: () => set({ authError: null }),
}));
