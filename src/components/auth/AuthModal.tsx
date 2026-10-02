import React, { useState } from 'react';
import {
  X,
  Mail,
  Lock,
  Sparkles,
  LogOut,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useToastStore } from '../ui/Toast';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const {
    currentUser,
    isAuthenticated,
    isLoading,
    authError,
    createGuestProfile,
    signInWithEmail,
    signUpWithEmail,
    signInWithOtp,
    signOut,
    updateCurrentUser,
    clearError,
  } = useAuthStore();

  const addToast = useToastStore((s) => s.addToast);

  // Unauthenticated tabs: 'account' | 'guest'
  const [unauthTab, setUnauthTab] = useState<'account' | 'guest'>('account');
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'magic'>('signin');

  // Supabase Auth Form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');

  // Guest creation
  const [guestName, setGuestName] = useState('');
  const [guestUsername, setGuestUsername] = useState('');

  // Profile Edit Form (when logged in)
  const [editName, setEditName] = useState(currentUser.name);
  const [editUsername, setEditUsername] = useState(currentUser.username);
  const [editAvatar, setEditAvatar] = useState(currentUser.avatar);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  if (!isOpen) return null;

  const handleCreateGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;
    const user = createGuestProfile(
      guestName.trim(),
      guestUsername.trim() || guestName.trim().toLowerCase().replace(/\s+/g, '')
    );
    addToast(`Listening as ${user.name} (@${user.username})`, 'success');
    setGuestName('');
    setGuestUsername('');
    onClose();
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (authMode === 'signin') {
      const res = await signInWithEmail(email, password);
      if (!res.error) {
        addToast('Signed in successfully!', 'success');
        onClose();
      }
    } else if (authMode === 'signup') {
      if (!username.trim() || !name.trim()) {
        addToast('Please enter your name and desired username', 'error');
        return;
      }
      const res = await signUpWithEmail(email, password, name, username);
      if (!res.error) {
        addToast('Account created and signed in!', 'success');
        onClose();
      }
    } else if (authMode === 'magic') {
      const res = await signInWithOtp(email);
      if (!res.error) {
        addToast('Magic link sent to your email!', 'success');
      }
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;

    setIsSavingProfile(true);
    try {
      updateCurrentUser({
        name: editName.trim(),
        username: editUsername.trim().replace(/^@/, '') || currentUser.username,
        avatar: editAvatar.trim() || currentUser.avatar,
      });
      addToast('Profile updated!', 'success');
    } catch {
      addToast('Could not save profile', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    addToast('Signed out of Supabase', 'info');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md bg-surface border border-border/80 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-accent-cream/10 border border-accent-cream/25 flex items-center justify-center text-accent-cream">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary font-display">
                {isAuthenticated ? 'Your Account' : 'Sound Identity'}
              </h2>
              <p className="text-xs text-text-muted">
                {isAuthenticated ? 'Manage your account profile' : 'Sign in or start as a guest'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Active User Banner */}
        <div className="px-6 py-3.5 bg-surface-elevated/70 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-accent-cream/30"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-text-primary">{currentUser.name}</span>
                {isAuthenticated && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-accent-emerald/15 text-[10px] text-accent-emerald border border-accent-emerald/30 font-medium">
                    <ShieldCheck className="w-3 h-3" /> Verified
                  </span>
                )}
              </div>
              <span className="text-[11px] text-text-muted">@{currentUser.username}</span>
            </div>
          </div>

          {isAuthenticated ? (
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-accent-crimson hover:bg-accent-crimson/10 rounded-lg transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          ) : (
            <span className="text-[11px] text-text-muted px-2 py-1 rounded bg-white/5">
              Guest Session
            </span>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {isAuthenticated ? (
            /* AUTHENTICATED: Edit Profile Form */
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-surface-elevated border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary focus:outline-none focus:border-border-focus"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full bg-surface-elevated border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary focus:outline-none focus:border-border-focus"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">
                  Avatar
                </label>
                <div className="flex items-center gap-3 mb-2">
                  <img
                    src={editAvatar || currentUser.avatar}
                    alt="Preview"
                    className="w-12 h-12 rounded-full object-cover border border-white/20"
                  />
                  <div className="flex-1">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated border border-border hover:border-white/20 text-xs text-white">
                      <span>Upload Avatar</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) {
                            addToast('Avatar must be under 2MB', 'error');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            if (typeof ev.target?.result === 'string') {
                              setEditAvatar(ev.target.result);
                              addToast('Avatar loaded!', 'success');
                            }
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                    <p className="text-[10px] text-text-muted mt-1">Max 2MB. Presets below:</p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-2">
                  {[
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
                    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
                    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80',
                    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&q=80'
                  ].map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setEditAvatar(url)}
                      className={`relative aspect-square rounded-xl overflow-hidden border transition-all ${
                        editAvatar === url ? 'ring-2 ring-accent-cream border-transparent' : 'border-white/10 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={url} alt={`Preset ${i + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingProfile || !editName.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-accent-cream text-bg font-semibold text-xs hover:bg-accent-creamHover transition-all active:scale-[0.99] disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Profile Changes</span>
              </button>
            </form>
          ) : (
            /* UNAUTHENTICATED: Supabase Sign In / Up or Guest */
            <div className="space-y-5">
              {/* Tabs */}
              <div className="flex bg-surface-elevated p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setUnauthTab('account')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    unauthTab === 'account'
                      ? 'bg-bg text-text-primary shadow-sm font-semibold'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  Account Login
                </button>
                <button
                  type="button"
                  onClick={() => setUnauthTab('guest')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    unauthTab === 'guest'
                      ? 'bg-bg text-text-primary shadow-sm font-semibold'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  Guest Nickname
                </button>
              </div>

              {unauthTab === 'account' ? (
                <div className="space-y-4">
                  {/* Mode Selector */}
                  <div className="flex bg-surface-elevated/60 p-1 rounded-xl border border-border/40">
                    <button
                      type="button"
                      onClick={() => setAuthMode('signin')}
                      className={`flex-1 py-1 text-[11px] rounded-lg transition-all ${
                        authMode === 'signin'
                          ? 'bg-accent-cream text-bg font-semibold shadow-sm'
                          : 'text-text-muted hover:text-text-secondary'
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode('signup')}
                      className={`flex-1 py-1 text-[11px] rounded-lg transition-all ${
                        authMode === 'signup'
                          ? 'bg-accent-cream text-bg font-semibold shadow-sm'
                          : 'text-text-muted hover:text-text-secondary'
                      }`}
                    >
                      Sign Up
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode('magic')}
                      className={`flex-1 py-1 text-[11px] rounded-lg transition-all ${
                        authMode === 'magic'
                          ? 'bg-accent-cream text-bg font-semibold shadow-sm'
                          : 'text-text-muted hover:text-text-secondary'
                      }`}
                    >
                      Magic Link
                    </button>
                  </div>

                  {authError && (
                    <div className="p-3 rounded-xl bg-accent-crimson/10 border border-accent-crimson/30 text-xs text-accent-crimson">
                      {authError}
                    </div>
                  )}

                  <form onSubmit={handleAuthSubmit} className="space-y-3">
                    {authMode === 'signup' && (
                      <>
                        <div>
                          <label className="text-[11px] font-medium text-text-secondary block mb-1">
                            Your Name
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Jordan Blake"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-surface-elevated border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-text-secondary block mb-1">
                            Username
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. jordan"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-surface-elevated border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="text-[11px] font-medium text-text-secondary block mb-1">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          required
                          placeholder="you@domain.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full bg-surface-elevated border border-border rounded-xl pl-9 pr-3.5 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
                        />
                      </div>
                    </div>

                    {authMode !== 'magic' && (
                      <div>
                        <label className="text-[11px] font-medium text-text-secondary block mb-1">
                          Password
                        </label>
                        <div className="relative">
                          <Lock className="w-3.5 h-3.5 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="password"
                            required
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-surface-elevated border border-border rounded-xl pl-9 pr-3.5 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
                          />
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-accent-cream text-bg font-semibold text-xs hover:bg-accent-creamHover transition-all active:scale-[0.99] disabled:opacity-50 mt-1"
                    >
                      {isLoading ? (
                        <div className="w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>
                            {authMode === 'signin' && 'Sign In'}
                            {authMode === 'signup' && 'Create Account'}
                            {authMode === 'magic' && 'Send Magic Login Link'}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              ) : (
                /* Guest Name Form */
                <form onSubmit={handleCreateGuest} className="space-y-3">
                  <div>
                    <label className="text-[11px] font-medium text-text-secondary block mb-1">
                      Guest Nickname
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Luna"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="w-full bg-surface-elevated border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-text-secondary block mb-1">
                      Username (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. luna_sounds"
                      value={guestUsername}
                      onChange={(e) => setGuestUsername(e.target.value)}
                      className="w-full bg-surface-elevated border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!guestName.trim()}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-accent-cream text-bg font-semibold text-xs hover:bg-accent-creamHover transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-2"
                  >
                    <span>Start as Guest</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
