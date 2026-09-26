import React, { useState } from 'react';
import { X, Check, User as UserIcon, Mail, Lock, Sparkles, LogOut, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { DEMO_USERS } from '../../data/mockData';
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
    switchProfile,
    createGuestProfile,
    signInWithEmail,
    signUpWithEmail,
    signInWithOtp,
    signOut,
    clearError,
  } = useAuthStore();

  const addToast = useToastStore((s) => s.addToast);

  const [activeTab, setActiveTab] = useState<'profiles' | 'account'>('profiles');
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'magic'>('signin');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');

  // Guest creation states
  const [guestName, setGuestName] = useState('');
  const [guestUsername, setGuestUsername] = useState('');

  if (!isOpen) return null;

  const handleSelectDemoUser = (user: typeof currentUser) => {
    switchProfile(user);
    addToast(`Switched identity to @${user.username}`, 'info');
    onClose();
  };

  const handleCreateGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;
    const user = createGuestProfile(guestName, guestUsername || guestName.toLowerCase().replace(/\s+/g, ''));
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
      <div className="relative w-full max-w-lg bg-surface border border-border/80 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-accent-cream/10 border border-accent-cream/25 flex items-center justify-center text-accent-cream">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary font-display">Your Sound Identity</h2>
              <p className="text-xs text-text-muted">Choose a profile or connect your Supabase account</p>
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
        <div className="px-6 py-3 bg-surface-elevated/70 border-b border-border/40 flex items-center justify-between">
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
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-accent-emerald/15 text-[10px] text-accent-emerald border border-accent-emerald/30 font-medium">
                    <ShieldCheck className="w-3 h-3" /> Supabase
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
            <span className="text-[11px] text-text-muted px-2 py-1 rounded bg-white/5">Guest Session</span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border/50 px-6 pt-2">
          <button
            onClick={() => setActiveTab('profiles')}
            className={`flex items-center gap-2 py-2.5 px-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'profiles'
                ? 'border-accent-cream text-accent-cream'
                : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            Quick Profiles
          </button>
          <button
            onClick={() => setActiveTab('account')}
            className={`flex items-center gap-2 py-2.5 px-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'account'
                ? 'border-accent-cream text-accent-cream'
                : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            Supabase Auth
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'profiles' ? (
            <div className="space-y-5">
              {/* Preset avatars grid */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-text-muted block mb-3">
                  Switch Active Profile
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {Object.values(DEMO_USERS).map((user) => {
                    const isSelected = currentUser.id === user.id;
                    return (
                      <button
                        key={user.id}
                        onClick={() => handleSelectDemoUser(user)}
                        className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-accent-cream/10 border-accent-cream/50 shadow-sm'
                            : 'bg-surface-elevated/40 border-border/50 hover:bg-surface-elevated hover:border-border-focus'
                        }`}
                      >
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="w-9 h-9 rounded-full object-cover ring-1 ring-white/10 flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-text-primary truncate">{user.name}</p>
                          <p className="text-[10px] text-text-muted truncate">@{user.username}</p>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-accent-cream flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Create custom guest */}
              <div className="pt-4 border-t border-border/50">
                <label className="text-xs font-semibold uppercase tracking-wider text-text-muted block mb-3">
                  Or Create Custom Persona
                </label>
                <form onSubmit={handleCreateGuest} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      placeholder="Display Name (e.g. Luna)"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="bg-surface-elevated border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
                    />
                    <input
                      type="text"
                      placeholder="Username (e.g. luna_sounds)"
                      value={guestUsername}
                      onChange={(e) => setGuestUsername(e.target.value)}
                      className="bg-surface-elevated border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!guestName.trim()}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-surface-elevated border border-border text-xs font-medium text-text-primary hover:border-accent-cream hover:text-accent-cream transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>Use Custom Persona</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Sub tabs: signin / signup / magic */}
              <div className="flex bg-surface-elevated p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setAuthMode('signin')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    authMode === 'signin' ? 'bg-bg text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    authMode === 'signup' ? 'bg-bg text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  Sign Up
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('magic')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    authMode === 'magic' ? 'bg-bg text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
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
                      <label className="text-[11px] font-medium text-text-secondary block mb-1">Your Full Name</label>
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
                      <label className="text-[11px] font-medium text-text-secondary block mb-1">Unique Username</label>
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
                  <label className="text-[11px] font-medium text-text-secondary block mb-1">Email Address</label>
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
                    <label className="text-[11px] font-medium text-text-secondary block mb-1">Password</label>
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
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-accent-cream text-bg font-semibold text-xs hover:bg-accent-creamHover transition-all shadow-glow-subtle active:scale-[0.99] disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>
                        {authMode === 'signin' && 'Sign In with Supabase'}
                        {authMode === 'signup' && 'Create Supabase Account'}
                        {authMode === 'magic' && 'Send Magic Login Link'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>

              <p className="text-[10px] text-text-muted text-center pt-2">
                Authentication provided by your connected Supabase project.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
