import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
  Disc3,
  CheckCircle2,
  Flame,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';
import { useToastStore } from '../components/ui/Toast';

/**
 * Constrain the post-login destination to an in-app path.
 *
 * `?redirect=` came straight off the query string and went into navigate() at
 * four call sites with no validation, so a crafted link could aim a successful
 * sign-in at an attacker's page. Only same-origin, single-slash, non-protocol
 * paths are accepted; anything else falls back to the Discover page.
 */
function safeRedirect(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/')) return '/';
  // `//evil.tld` and `/\evil.tld` are treated as protocol-relative by browsers.
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  if (raw.includes('\\')) return '/';
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(raw)) return '/';
  return raw;
}

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = safeRedirect(searchParams.get('redirect'));
  const reason = searchParams.get('reason');

  const {
    currentUser,
    isAuthenticated,
    isLoading,
    authError,
    signInWithEmail,
    signUpWithEmail,
    signInWithOtp,
    createGuestProfile,
    clearError,
  } = useAuthStore();

  const addToast = useToastStore((s) => s.addToast);

  const [mode, setMode] = useState<'signin' | 'signup' | 'magic' | 'guest'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [guestName, setGuestName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (mode === 'signin') {
      const res = await signInWithEmail(email, password);
      if (!res.error) {
        addToast('Signed in successfully!', 'success');
        navigate(redirect);
      } else {
        addToast(res.error, 'error');
      }
    } else if (mode === 'signup') {
      if (!username.trim() || !name.trim()) {
        addToast('Please enter your name and username', 'error');
        return;
      }
      const res = await signUpWithEmail(email, password, name, username);
      if (!res.error) {
        addToast('Account created and signed in!', 'success');
        navigate(redirect);
      } else {
        const isInfo = res.error.includes('Confirmation') || res.error.includes('check your email');
        addToast(res.error, isInfo ? 'info' : 'error');
      }
    } else if (mode === 'magic') {
      const res = await signInWithOtp(email);
      if (!res.error) {
        addToast('Magic link sent to your email!', 'success');
      } else {
        addToast(res.error, 'error');
      }
    }
  };


  const handleCustomGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;
    const user = createGuestProfile(guestName, guestName.toLowerCase().replace(/\s+/g, ''));
    addToast(`Welcome ${user.name}! (Guest mode)`, 'success');
    navigate(redirect);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden bg-bg">
      {/* Ambient background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-accent-cream/5 rounded-full filter blur-[180px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Side: Brand & Value Proposition */}
        <div className="lg:col-span-6 space-y-6">
          <Link to="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-2xl bg-surface-elevated border border-white/10 flex items-center justify-center text-text-primary group-hover:border-white/25 transition-all">
              <Disc3 className="w-5 h-5 text-accent-cream group-hover:rotate-45 transition-transform duration-500" />
            </div>
            <span className="font-display font-bold text-2xl tracking-tight text-text-primary">
              Modern
            </span>
          </Link>

          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary font-display">
              {reason === 'limit' ? 'Unlock Unlimited Rooms' : 'Your Shared Audio Sanctuary'}
            </h1>
            <p className="text-sm text-text-secondary mt-2 leading-relaxed">
              Listen in perfect sync with friends, cast frequency visualizers, queue favorite tracks, and host collective listening spaces.
            </p>
          </div>

          {/* Reason Alert (if redirected due to 5-room guest limit) */}
          {reason === 'limit' && (
            <div className="p-4 rounded-2xl bg-accent-amber/10 border border-accent-amber/30 space-y-1.5 animate-in fade-in duration-300">
              <div className="flex items-center gap-2 text-accent-amber font-semibold text-xs">
                <Flame className="w-4 h-4" />
                <span>Daily Guest Limit Reached (5/5 Rooms)</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Guests can create up to 5 rooms per day. Sign in or create a free account to unlock <strong>unlimited room creation</strong> and persistent sound profiles!
              </p>
            </div>
          )}

          {/* Benefits List */}
          <div className="space-y-3 pt-2">
            {[
              { title: 'Unlimited Room Creation', desc: 'Host as many synchronized listening rooms as you want each day.' },
              { title: 'Persistent Sound Identity', desc: 'Retain your curator avatar, bio, and stats across all sessions.' },
              { title: 'Always Free Guest Mode', desc: 'Joining rooms, queueing, and listening is 100% free and unlimited.' },
              { title: 'Full Host Audio Controls', desc: 'Access granular queue voting permissions, bitrates, and visualizers.' },
            ].map((b, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-surface-elevated/40 border border-border/40">
                <div className="w-5 h-5 rounded-full bg-accent-cream/10 border border-accent-cream/30 flex items-center justify-center text-accent-cream flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-text-primary">{b.title}</h3>
                  <p className="text-[11px] text-text-muted mt-0.5">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Auth Form Card */}
        <div className="lg:col-span-6 bg-surface/90 border border-border/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative">
          {/* Active User Header if already logged in */}
          {isAuthenticated ? (
            <div className="text-center space-y-4 py-4">
              <div className="relative inline-block">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-16 h-16 rounded-full object-cover mx-auto ring-2 ring-accent-cream"
                />
                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-accent-emerald ring-2 ring-surface" />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-primary">{currentUser.name}</h3>
                <p className="text-xs text-text-muted">@{currentUser.username}</p>
                <div className="inline-flex items-center gap-1 mt-2 px-2.5 py-0.5 rounded-full bg-accent-emerald/10 border border-accent-emerald/30 text-[11px] text-accent-emerald font-medium">
                  <ShieldCheck className="w-3 h-3" /> Signed in with Supabase
                </div>
              </div>
              <div className="pt-4 flex flex-col gap-2">
                <button
                  onClick={() => navigate(redirect)}
                  className="w-full py-2.5 px-4 rounded-xl bg-accent-cream text-bg font-semibold text-xs hover:bg-accent-creamHover transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>Continue as @{currentUser.username}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setMode('guest')}
                  className="w-full py-2 px-4 rounded-xl bg-surface-elevated text-text-secondary text-xs hover:text-text-primary transition-colors"
                >
                  Switch to Another Profile
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Mode Toggle Tabs */}
              <div className="grid grid-cols-4 bg-surface-elevated p-1 rounded-2xl border border-border/50 text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className={`py-2 rounded-xl transition-all ${
                    mode === 'signin' ? 'bg-bg text-text-primary shadow-sm font-semibold' : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className={`py-2 rounded-xl transition-all ${
                    mode === 'signup' ? 'bg-bg text-text-primary shadow-sm font-semibold' : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  Sign Up
                </button>
                <button
                  type="button"
                  onClick={() => setMode('magic')}
                  className={`py-2 rounded-xl transition-all ${
                    mode === 'magic' ? 'bg-bg text-text-primary shadow-sm font-semibold' : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  Magic Link
                </button>
                <button
                  type="button"
                  onClick={() => setMode('guest')}
                  className={`py-2 rounded-xl transition-all ${
                    mode === 'guest' ? 'bg-bg text-text-primary shadow-sm font-semibold' : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  Guest
                </button>
              </div>

              {authError && (
                <div
                  className={`p-4 rounded-2xl border text-xs leading-relaxed space-y-1.5 ${
                    authError.includes('Confirmation') || authError.includes('check your email')
                      ? 'bg-accent-cream/10 border-accent-cream/30 text-accent-cream'
                      : 'bg-accent-crimson/10 border-accent-crimson/30 text-accent-crimson'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    {authError.includes('Confirmation') || authError.includes('check your email') ? (
                      <span>✉️ Verification Link Sent</span>
                    ) : (
                      <span>⚠️ Authentication Notice</span>
                    )}
                  </div>
                  <p>{authError}</p>
                  {authError.includes('Authentication -> Users') && (
                    <div className="pt-2 mt-2 border-t border-white/10 text-[11px] text-text-secondary">
                      💡 <strong>Supabase Tip:</strong> If you deleted the row from the <code>profiles</code> table, the user identity still lives in <strong>Supabase Dashboard → Authentication → Users</strong>. You can either sign in with your existing password, or delete the user from Authentication → Users to start completely fresh.
                    </div>
                  )}
                </div>
              )}

              {/* Guest Persona Mode */}
              {mode === 'guest' ? (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div>
                    <label className="text-xs font-semibold text-text-secondary block mb-1">
                      Guest Nickname
                    </label>
                    <p className="text-[11px] text-text-muted mb-3">
                      Join rooms and chat right away without creating an account.
                    </p>
                    <form onSubmit={handleCustomGuest} className="space-y-3">
                      <input
                        type="text"
                        placeholder="Your Nickname (e.g. Luna)"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        className="w-full bg-surface-elevated border border-border rounded-xl px-3.5 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
                      />
                      <button
                        type="submit"
                        disabled={!guestName.trim()}
                        className="w-full py-2.5 px-4 rounded-xl bg-accent-cream text-bg font-semibold text-xs hover:bg-accent-creamHover transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                      >
                        <span>Start as Guest Listener</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                /* Email & Password / Magic Link Form */
                <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in duration-200">
                  {mode === 'signup' && (
                    <>
                      <div>
                        <label className="text-[11px] font-medium text-text-secondary block mb-1">Full Name</label>
                        <input
                          type="text"
                          required
                          placeholder="Jordan Blake"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full bg-surface-elevated border border-border rounded-xl px-3.5 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-text-secondary block mb-1">Username</label>
                        <input
                          type="text"
                          required
                          placeholder="jordan_music"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="w-full bg-surface-elevated border border-border rounded-xl px-3.5 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="text-[11px] font-medium text-text-secondary block mb-1">Email Address</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        placeholder="you@domain.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-surface-elevated border border-border rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
                      />
                    </div>
                  </div>

                  {mode !== 'magic' && (
                    <div>
                      <label className="text-[11px] font-medium text-text-secondary block mb-1">Password</label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="password"
                          required
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full bg-surface-elevated border border-border rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 px-4 rounded-xl bg-accent-cream text-bg font-bold text-xs hover:bg-accent-creamHover transition-all shadow-glow-subtle flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50 mt-2"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>
                          {mode === 'signin' && 'Sign In to Modern'}
                          {mode === 'signup' && 'Create Account & Unlock Unlimited'}
                          {mode === 'magic' && 'Send Magic Login Link'}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              <div className="pt-2 text-center">
                <Link
                  to="/"
                  className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                >
                  ← Back to Listening Rooms
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
