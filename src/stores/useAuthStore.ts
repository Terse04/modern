import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { User } from '../types';
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
  updateCurrentUser: (updates: Partial<User>) => void;
  clearError: () => void;
}

// Ensure usePlaybackStore is imported at the top, or required here to avoid circular dep issues.
function resetPlaybackStore() {
  import('./usePlaybackStore').then(({ usePlaybackStore }) => {
    usePlaybackStore.getState().resetPlaybackState();
  }).catch((e: unknown) => {
    console.warn('Failed to reset playback state:', e);
  });
}

function resetRealtimeStore() {
  import('../services/realtimeService').then(({ realtimeService }) => {
    realtimeService.leaveChannel();
  }).catch((e: unknown) => {
    console.warn('Failed to reset realtime state:', e);
  });
}

function getStoredUser(): User {
  if (typeof window === 'undefined') return ANONYMOUS_GUEST;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Strip privileged keys
      return {
        id: parsed.id,
        username: parsed.username,
        name: parsed.name,
        avatar: parsed.avatar,
        isAdmin: false,
        isBanned: false,
        isHost: false,
        role: 'listener',
      };
    }
  } catch (err) {
    console.warn('Failed to parse stored user:', err);
  }
  return ANONYMOUS_GUEST;
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // 1. Primary lookup by profiles.id = authUserId (matches Supabase Auth UID -> profiles.id)
  const { data: byId, error: errById } = await client
    .from('profiles')
    .select('*')
    .eq('id', authUserId)
    .maybeSingle();

  if (!errById && byId) {
    return mapProfile(byId);
  }

  // 2. Secondary lookup by auth_user_id column if present
  try {
    const { data: byAuthId, error: errByAuthId } = await client
      .from('profiles')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (!errByAuthId && byAuthId) {
      return mapProfile(byAuthId);
    }
  } catch {
    // Column may not exist in current schema
  }

  return null;
}

/**
 * Ensures a profile row exists in public.profiles for an authenticated user.
 * If the user's row was deleted or failed to create via trigger, this automatically
 * re-creates it in the database and returns the User object.
 */
async function ensureProfileForAuthUser(
  client: NonNullable<typeof supabase>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessionUser: { id: string; email?: string; user_metadata?: any }
): Promise<User> {
  const existing = await fetchProfileByAuthUser(client, sessionUser.id);
  if (existing) return existing;

  console.warn('[Auth] No profile row found for auth user. Auto-repairing profile...');
  const meta = sessionUser.user_metadata || {};
  const baseUsername =
    (meta.username || sessionUser.email?.split('@')[0] || 'listener')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 24) || `user_${sessionUser.id.replace(/-/g, '').slice(0, 8)}`;

  const cleanUsername = baseUsername.length >= 2 ? baseUsername : baseUsername.padEnd(2, '0');
  const cleanName = meta.name || sessionUser.email?.split('@')[0] || 'Listener';
  const avatar =
    meta.avatar_url ||
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80';
    
  const fallbackId = `usr_${sessionUser.id.replace(/-/g, '').slice(0, 12)}`;

  try {
    const { data: inserted, error: insertErr } = await client
      .from('profiles')
      .upsert(
        {
          id: fallbackId,
          auth_user_id: sessionUser.id,
          username: cleanUsername,
          name: cleanName,
          avatar,
          current_status: 'Listening with friends',
          role: 'listener',
        },
        { onConflict: 'id' }
      )
      .select('*')
      .maybeSingle();

    if (!insertErr && inserted) {
      return mapProfile(inserted);
    }

    // If username collided with another profile, try with random suffix
    if (insertErr && insertErr.code === '23505') {
      const fallbackUsername = `${cleanUsername.slice(0, 18)}_${Math.random().toString(36).slice(2, 6)}`;
      const { data: retryInserted } = await client
        .from('profiles')
        .upsert(
          {
            id: fallbackId,
            auth_user_id: sessionUser.id,
            username: fallbackUsername,
            name: cleanName,
            avatar,
            current_status: 'Listening with friends',
            role: 'listener',
          },
          { onConflict: 'id' }
        )
        .select('*')
        .maybeSingle();

      if (retryInserted) {
        return mapProfile(retryInserted);
      }
    }
  } catch (err) {
    console.warn('[Auth] Failed to recreate deleted profile row in Supabase:', err);
  }

  // Fallback memory user with valid auth UUID
  return {
    id: fallbackId,
    username: cleanUsername,
    name: cleanName,
    avatar,
    role: 'listener',
  };
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
        const user = await ensureProfileForAuthUser(client, session.user);
        saveStoredUser(user);
        set({ currentUser: user, session, isAuthenticated: true, isLoading: false });
      } else {
        set({ session: null, isAuthenticated: false, isLoading: false });
      }
    });

    // 2. Listen to auth changes
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        if (session?.user) {
          const user = await ensureProfileForAuthUser(client, session.user);
          saveStoredUser(user);
          set({ currentUser: user, session, isAuthenticated: true, isLoading: false });
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
    resetPlaybackStore();
    resetRealtimeStore();
    saveStoredUser(user);
    set({ currentUser: user, authError: null });
  },

  updateCurrentUser: (updates: Partial<User>) => {
    // Reject privileged keys
    const safeUpdates = { ...updates };
    delete safeUpdates.isAdmin;
    delete safeUpdates.isBanned;
    delete safeUpdates.isHost;
    delete safeUpdates.role;
    
    set((state) => {
      const updated: User = { ...state.currentUser, ...safeUpdates };
      saveStoredUser(updated);
      return { currentUser: updated };
    });
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
      email: email.trim(),
      password,
      options: {
        data: {
          name: cleanName,
          username: cleanUsername,
          avatar_url: defaultAvatar,
        },
      },
    });

    // 1. Handle error response from Supabase
    if (error) {
      const errLower = error.message.toLowerCase();
      // If user is already registered in auth.users (common after deleting profiles row from Table Editor)
      if (errLower.includes('already') || errLower.includes('registered')) {
        // Automatically attempt sign in with the provided password
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (!signInErr && signInData.session && signInData.user) {
          const user = await ensureProfileForAuthUser(supabase, signInData.user);
          saveStoredUser(user);
          set({ currentUser: user, session: signInData.session, isAuthenticated: true, isLoading: false, authError: null });
          return {};
        }

        const msg =
          'This email is already registered in Supabase. If you previously deleted the user from the Table Editor, the login still exists in Supabase Authentication -> Users. Please Sign In with your password, or delete the user from Authentication -> Users in Supabase.';
        set({ isLoading: false, authError: msg });
        return { error: msg };
      }

      set({ isLoading: false, authError: error.message });
      return { error: error.message };
    }

    if (!data.user) {
      set({ isLoading: false, authError: 'Sign up did not return a user.' });
      return { error: 'Sign up did not return a user.' };
    }

    // 2. Check for empty identities (Supabase obfuscates existing emails when email confirmations are ON)
    if (data.user.identities && data.user.identities.length === 0) {
      // Attempt sign in with password
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (!signInErr && signInData.session && signInData.user) {
        const user = await ensureProfileForAuthUser(supabase, signInData.user);
        saveStoredUser(user);
        set({ currentUser: user, session: signInData.session, isAuthenticated: true, isLoading: false, authError: null });
        return {};
      }

      const msg =
        'This email already exists in Supabase Authentication. If you deleted the profile row, the login credentials still remain. Please sign in with your password, or delete the user from Supabase Dashboard -> Authentication -> Users.';
      set({ isLoading: false, authError: msg });
      return { error: msg };
    }

    // 3. Check if email confirmation is required (session is null when email confirmation is ON)
    if (!data.session) {
      const msg =
        'Confirmation email sent! Please check your email inbox to verify your account, or disable "Confirm email" in Supabase Auth -> Providers -> Email for instant login.';
      set({ isLoading: false, authError: msg });
      return { error: msg };
    }

    // 4. Session exists: ensure profile row and log in immediately
    const user = await ensureProfileForAuthUser(supabase, data.user);
    saveStoredUser(user);
    set({ currentUser: user, session: data.session, isAuthenticated: true, isLoading: false, authError: null });

    return {};
  },

  signInWithEmail: async (email, password) => {
    if (!isSupabaseConfigured || !supabase) {
      return { error: 'Supabase is not configured yet.' };
    }
    set({ isLoading: true, authError: null });

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      set({ isLoading: false, authError: error.message });
      return { error: error.message };
    }

    if (data.user && data.session) {
      const user = await ensureProfileForAuthUser(supabase, data.user);
      saveStoredUser(user);
      set({ currentUser: user, session: data.session, isAuthenticated: true, isLoading: false, authError: null });
      return {};
    }

    set({ isLoading: false });
    return { error: 'Could not create session. Please check your credentials.' };
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
    resetPlaybackStore();
    resetRealtimeStore();
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
