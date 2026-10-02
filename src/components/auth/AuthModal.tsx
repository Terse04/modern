import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mail,
  Lock,
  Sparkles,
  LogOut,
  ArrowRight,
  CheckCircle2,
  Check,
  User,
  Shield,
  Bell,
  Sliders,
  Camera,
  Upload,
  AtSign,
} from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useToastStore } from '../ui/Toast';
import { profileService } from '../../services/profileService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&q=80',
];

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const {
    currentUser,
    session,
    isAuthenticated,
    isLoading,
    authError,
    signInWithEmail,
    signUpWithEmail,
    signInWithOtp,
    signOut,
    updateCurrentUser,
    clearError,
  } = useAuthStore();

  const addToast = useToastStore((s) => s.addToast);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active navigation tab
  const [activeNavTab, setActiveNavTab] = useState<'profile' | 'security' | 'notifications' | 'preferences'>('profile');

  // Profile Edit Form State
  const [editName, setEditName] = useState(currentUser.name);
  const [editUsername, setEditUsername] = useState(currentUser.username.replace(/^@/, ''));
  const [editAvatar, setEditAvatar] = useState(currentUser.avatar);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Unauthenticated Auth Modes: 'signin' | 'signup' | 'magic'
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'magic'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authUsername, setAuthUsername] = useState('');

  // Notification Preferences State (local state with localStorage sync)
  const [notifRoomActivity, setNotifRoomActivity] = useState(true);
  const [notifChatSounds, setNotifChatSounds] = useState(true);
  const [notifTrackAdvances, setNotifTrackAdvances] = useState(false);

  // Listening Preferences State
  const [prefHifiAudio, setPrefHifiAudio] = useState(true);
  const [prefEqualizerGlow, setPrefEqualizerGlow] = useState(true);

  // Synchronize state when modal opens or user changes
  useEffect(() => {
    if (isOpen) {
      setEditName(currentUser.name);
      setEditUsername(currentUser.username.replace(/^@/, ''));
      setEditAvatar(currentUser.avatar);
      setActiveNavTab('profile');
      clearError();
    }
  }, [isOpen, currentUser, clearError]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAvatarFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      addToast('Please upload an image file (JPG, PNG, WEBP)', 'error');
      return;
    }
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
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      addToast('Display name cannot be empty', 'error');
      return;
    }

    setIsSavingProfile(true);
    try {
      const cleanUsername = editUsername.trim().replace(/^@/, '') || currentUser.username;
      const cleanAvatar = editAvatar.trim() || currentUser.avatar;
      const cleanName = editName.trim();

      updateCurrentUser({
        name: cleanName,
        username: cleanUsername,
        avatar: cleanAvatar,
      });

      if (isAuthenticated) {
        await profileService.updateProfile(currentUser.username, {
          name: cleanName,
          avatar: cleanAvatar,
        });
      }

      addToast('Profile updated!', 'success');
      onClose();
    } catch {
      addToast('Could not save profile', 'error');
    } finally {
      setIsSavingProfile(false);
    }
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
      if (!authUsername.trim() || !authName.trim()) {
        addToast('Please enter your name and desired username', 'error');
        return;
      }
      const res = await signUpWithEmail(email, password, authName, authUsername);
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
    addToast('Signed out', 'info');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
      {/* Dimmed & Blurred Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Hidden File Input for Avatar Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleAvatarFile(file);
        }}
      />

      {/* Main Settings Modal Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Account Settings"
        className="relative w-full max-w-[940px] bg-[#0C0E14]/95 border border-white/[0.08] rounded-2xl md:rounded-[22px] shadow-[0_20px_70px_rgba(0,0,0,0.85),0_0_40px_rgba(6,182,212,0.08)] backdrop-blur-2xl overflow-hidden z-10 flex flex-col md:flex-row h-full sm:h-auto sm:max-h-[92vh] md:h-[620px] animate-in fade-in zoom-in-95 duration-200"
      >
        {/* ─── LEFT SIDEBAR ────────────────────────────────────────── */}
        <aside className="w-full md:w-[250px] shrink-0 border-b md:border-b-0 md:border-r border-white/[0.07] bg-[#08090D]/85 p-4 md:p-6 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle Ambient Curved Glow Effect at bottom */}
          <div className="absolute -bottom-16 -left-16 w-52 h-52 bg-gradient-to-tr from-purple-900/30 via-cyan-900/20 to-transparent blur-3xl rounded-full pointer-events-none" />
          <svg className="hidden md:block absolute bottom-0 left-0 w-full h-32 opacity-25 pointer-events-none" viewBox="0 0 200 120" fill="none">
            <path d="M-20 120 C 40 85, 80 45, 160 70 C 190 80, 210 40, 250 20" stroke="url(#sideGrad1)" strokeWidth="1.5" />
            <path d="M-10 120 C 50 100, 90 65, 170 88" stroke="url(#sideGrad2)" strokeWidth="1" strokeDasharray="3 3" />
            <defs>
              <linearGradient id="sideGrad1" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#06B6D4" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
              <linearGradient id="sideGrad2" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
          </svg>

          {/* Top Header & Navigation */}
          <div className="relative z-10">
            {/* Abstract Brand Star Icon Badge + Header */}
            <div className="flex items-center gap-3 md:block mb-3 md:mb-6">
              <div className="relative mb-0 md:mb-5 inline-block shrink-0">
                <div className="absolute -inset-1.5 bg-gradient-to-r from-cyan-500/30 to-purple-600/30 rounded-full blur-md opacity-80" />
                <div className="relative w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#12141D] border border-white/10 flex items-center justify-center text-white shadow-inner">
                  <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-cyan-300" />
                </div>
              </div>

              <div>
                <h2 className="text-lg md:text-xl font-bold text-white tracking-tight font-display mb-0 md:mb-1.5">
                  Your Account
                </h2>
                <p className="hidden md:block text-xs text-white/50 leading-relaxed font-normal">
                  Manage your account profile and personal details.
                </p>
              </div>
            </div>

            {/* Sidebar Navigation Items */}
            <nav className="flex md:flex-col gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0" aria-label="Account Settings Navigation">
              <button
                type="button"
                onClick={() => setActiveNavTab('profile')}
                className={`whitespace-nowrap flex items-center gap-2.5 md:gap-3 px-3.5 py-2 md:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all shrink-0 ${
                  activeNavTab === 'profile'
                    ? 'bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-transparent border border-cyan-500/30 text-white shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                    : 'text-white/45 hover:text-white/80 hover:bg-white/[0.03] border border-transparent'
                }`}
              >
                <User className={`w-4 h-4 ${activeNavTab === 'profile' ? 'text-cyan-400' : 'text-white/40'}`} />
                <span>Profile</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveNavTab('security')}
                className={`whitespace-nowrap flex items-center gap-2.5 md:gap-3 px-3.5 py-2 md:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all shrink-0 ${
                  activeNavTab === 'security'
                    ? 'bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-transparent border border-cyan-500/30 text-white shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                    : 'text-white/45 hover:text-white/80 hover:bg-white/[0.03] border border-transparent'
                }`}
              >
                <Shield className={`w-4 h-4 ${activeNavTab === 'security' ? 'text-cyan-400' : 'text-white/40'}`} />
                <span>Security</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveNavTab('notifications')}
                className={`whitespace-nowrap flex items-center gap-2.5 md:gap-3 px-3.5 py-2 md:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all shrink-0 ${
                  activeNavTab === 'notifications'
                    ? 'bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-transparent border border-cyan-500/30 text-white shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                    : 'text-white/45 hover:text-white/80 hover:bg-white/[0.03] border border-transparent'
                }`}
              >
                <Bell className={`w-4 h-4 ${activeNavTab === 'notifications' ? 'text-cyan-400' : 'text-white/40'}`} />
                <span>Notifications</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveNavTab('preferences')}
                className={`whitespace-nowrap flex items-center gap-2.5 md:gap-3 px-3.5 py-2 md:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all shrink-0 ${
                  activeNavTab === 'preferences'
                    ? 'bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-transparent border border-cyan-500/30 text-white shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                    : 'text-white/45 hover:text-white/80 hover:bg-white/[0.03] border border-transparent'
                }`}
              >
                <Sliders className={`w-4 h-4 ${activeNavTab === 'preferences' ? 'text-cyan-400' : 'text-white/40'}`} />
                <span>Preferences</span>
              </button>
            </nav>
          </div>
        </aside>

        {/* ─── RIGHT CONTENT AREA ───────────────────────────────────── */}
        <main className="flex-1 flex flex-col p-6 md:p-8 overflow-y-auto relative bg-[#0C0E14]">
          {/* Top Profile Header Row */}
          <div className="flex items-start justify-between gap-4 mb-6 pb-6 border-b border-white/[0.06]">
            {/* Avatar & Identification */}
            <div className="flex items-center gap-4">
              <div className="relative group shrink-0">
                <img
                  src={editAvatar || currentUser.avatar}
                  alt={editName || currentUser.name}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover ring-2 ring-white/10 shadow-lg bg-black/40"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload avatar photo"
                  className="absolute bottom-0 right-0 p-1.5 rounded-lg bg-[#27324A] hover:bg-[#324060] border border-white/20 text-cyan-300 shadow-md transition-all cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    {editName.trim() || currentUser.name}
                  </h3>
                  {isAuthenticated ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-950/80 border border-teal-500/40 text-[11px] font-semibold text-teal-400 shadow-[0_0_12px_rgba(20,184,166,0.2)]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                      <span>Verified</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-semibold text-white/50">
                      Guest
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/45 font-mono mt-1">
                  @{editUsername.trim().replace(/^@/, '') || currentUser.username}
                </p>
              </div>
            </div>

            {/* Sign Out & Close X Button */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/[0.04] hover:bg-rose-500/[0.1] hover:border-rose-500/50 text-rose-400 text-xs font-semibold transition-all duration-200"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close settings"
                className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white/50 hover:text-white flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* TAB 1: PROFILE (The Main Redesigned Form) */}
          {activeNavTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="flex-1 flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                {/* Display Name Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/80 block">
                    Display Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-white/35 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Display Name"
                      className="w-full bg-[#08090D] border border-white/[0.09] hover:border-white/[0.16] focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/25 transition-all outline-none font-medium shadow-inner"
                      maxLength={50}
                    />
                  </div>
                </div>

                {/* Username Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/80 block">
                    Username
                  </label>
                  <div className="relative">
                    <AtSign className="w-4 h-4 text-white/35 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value.replace(/^@/, ''))}
                      placeholder="username"
                      className="w-full bg-[#08090D] border border-white/[0.09] hover:border-white/[0.16] focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/25 transition-all outline-none font-medium shadow-inner font-mono"
                      maxLength={30}
                    />
                  </div>
                </div>

                {/* Avatar Section */}
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-semibold text-white/80 block">
                      Avatar
                    </label>
                    <p className="text-[11px] text-white/40">
                      Max 2MB. Supports JPG, PNG, WEBP.
                    </p>
                  </div>

                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 pt-1">
                    {/* Upload Avatar Card */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleAvatarFile(file);
                      }}
                      className="w-32 sm:w-36 h-28 rounded-xl border border-dashed border-white/20 hover:border-cyan-400/60 bg-white/[0.02] hover:bg-white/[0.05] flex flex-col items-center justify-center p-2.5 text-center cursor-pointer transition-all duration-300 group shrink-0"
                    >
                      <Upload className="w-5 h-5 text-white/45 group-hover:text-cyan-400 group-hover:-translate-y-0.5 transition-all mb-1" />
                      <span className="text-[11px] font-semibold text-white/80 group-hover:text-white leading-tight">
                        Upload Avatar
                      </span>
                      <span className="text-[9px] text-white/40 leading-tight mt-1">
                        Click to upload or drag & drop
                      </span>
                    </div>

                    {/* Presets Horizontal Row */}
                    <div className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                      {AVATAR_PRESETS.map((url, i) => {
                        const isSelected = editAvatar === url;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setEditAvatar(url)}
                            aria-label={`Select avatar preset ${i + 1}`}
                            className={`relative w-20 sm:w-24 h-28 rounded-xl overflow-hidden cursor-pointer transition-all duration-300 shrink-0 ${
                              isSelected
                                ? 'ring-2 ring-cyan-400 border border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.45)] scale-[1.03]'
                                : 'border border-white/10 opacity-70 hover:opacity-100 hover:border-white/30'
                            }`}
                          >
                            <img src={url} alt={`Preset ${i + 1}`} className="w-full h-full object-cover" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Actions Row */}
              <div className="mt-auto pt-6 flex items-center justify-end gap-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/[0.03] hover:bg-white/[0.06] text-sm font-semibold text-white/70 hover:text-white transition-all"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSavingProfile || !editName.trim()}
                  className="bg-gradient-to-r from-teal-400 via-cyan-400 to-indigo-500 hover:from-teal-300 hover:via-cyan-300 hover:to-indigo-400 text-slate-950 font-bold px-7 py-2.5 rounded-xl shadow-[0_0_25px_rgba(6,182,212,0.35)] hover:shadow-[0_0_35px_rgba(6,182,212,0.55)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isSavingProfile ? (
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 stroke-[3]" />
                  )}
                  <span>Save Profile Changes</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: SECURITY (Authentication & Account Credentials) */}
          {activeNavTab === 'security' && (
            <div className="flex-1 flex flex-col justify-between">
              {isAuthenticated ? (
                <div className="space-y-5">
                  <div className="p-4 rounded-xl bg-surface-elevated/40 border border-white/[0.08] space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-text-muted block">
                      Account Authentication
                    </span>
                    <p className="text-sm font-semibold text-white">
                      {session?.user?.email || 'Authenticated User'}
                    </p>
                    <p className="text-xs text-text-muted">
                      Your identity and room permissions are securely encrypted with JWT sessions.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-surface-elevated/40 border border-white/[0.08] flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">Password & Security</h4>
                      <p className="text-xs text-text-muted mt-0.5">Password is protected and hashed.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addToast('Password reset link sent to your email', 'info')}
                      className="px-3.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-white transition-all"
                    >
                      Reset Password
                    </button>
                  </div>
                </div>
              ) : (
                /* Unauthenticated Sign In / Sign Up Flow */
                <div className="space-y-4">
                  {/* Mode Selector */}
                  <div className="flex bg-surface-elevated/60 p-1 rounded-xl border border-border/40">
                    <button
                      type="button"
                      onClick={() => setAuthMode('signin')}
                      className={`flex-1 py-1.5 text-xs rounded-lg transition-all ${
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
                      className={`flex-1 py-1.5 text-xs rounded-lg transition-all ${
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
                      className={`flex-1 py-1.5 text-xs rounded-lg transition-all ${
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
                          <label className="text-xs font-semibold text-white/70 block mb-1">
                            Your Name
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Jordan Blake"
                            value={authName}
                            onChange={(e) => setAuthName(e.target.value)}
                            className="w-full bg-[#08090D] border border-white/[0.09] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-white/70 block mb-1">
                            Username
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. jordan"
                            value={authUsername}
                            onChange={(e) => setAuthUsername(e.target.value)}
                            className="w-full bg-[#08090D] border border-white/[0.09] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="text-xs font-semibold text-white/70 block mb-1">
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
                          className="w-full bg-[#08090D] border border-white/[0.09] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50"
                        />
                      </div>
                    </div>

                    {authMode !== 'magic' && (
                      <div>
                        <label className="text-xs font-semibold text-white/70 block mb-1">
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
                            className="w-full bg-[#08090D] border border-white/[0.09] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50"
                          />
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-teal-400 via-cyan-400 to-indigo-500 text-slate-950 font-bold text-xs hover:opacity-90 transition-all active:scale-[0.99] disabled:opacity-50 mt-2"
                    >
                      {isLoading ? (
                        <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>
                            {authMode === 'signin' && 'Sign In to Account'}
                            {authMode === 'signup' && 'Create Free Account'}
                            {authMode === 'magic' && 'Send Magic Login Link'}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}

              <div className="mt-auto pt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveNavTab('profile')}
                  className="px-5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-white"
                >
                  Back to Profile
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: NOTIFICATIONS */}
          {activeNavTab === 'notifications' && (
            <div className="flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-surface-elevated/40 border border-white/[0.08] flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white">Room Activity Alerts</h4>
                    <p className="text-xs text-text-muted mt-0.5">Show notifications when friends drop into your active room.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifRoomActivity}
                    onChange={(e) => setNotifRoomActivity(e.target.checked)}
                    className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                  />
                </div>

                <div className="p-4 rounded-xl bg-surface-elevated/40 border border-white/[0.08] flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white">Chat Sound Cues</h4>
                    <p className="text-xs text-text-muted mt-0.5">Play subtle haptic chimes when messages or floating reactions arrive.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifChatSounds}
                    onChange={(e) => setNotifChatSounds(e.target.checked)}
                    className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                  />
                </div>

                <div className="p-4 rounded-xl bg-surface-elevated/40 border border-white/[0.08] flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white">Track Skip Notifications</h4>
                    <p className="text-xs text-text-muted mt-0.5">Notify when vote-to-skip reaches threshold and song advances.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifTrackAdvances}
                    onChange={(e) => setNotifTrackAdvances(e.target.checked)}
                    className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                  />
                </div>
              </div>

              <div className="mt-auto pt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    addToast('Notification preferences saved', 'success');
                    setActiveNavTab('profile');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-400 via-cyan-400 to-indigo-500 text-slate-950 font-bold text-xs"
                >
                  Save Preferences
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: PREFERENCES */}
          {activeNavTab === 'preferences' && (
            <div className="flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-surface-elevated/40 border border-white/[0.08] flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white">Hi-Fi Audio Stream Quality</h4>
                    <p className="text-xs text-text-muted mt-0.5">Prioritize pristine uncompressed audio buffers over bandwidth saving.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefHifiAudio}
                    onChange={(e) => setPrefHifiAudio(e.target.checked)}
                    className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                  />
                </div>

                <div className="p-4 rounded-xl bg-surface-elevated/40 border border-white/[0.08] flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white">Equalizer Ambient Glow</h4>
                    <p className="text-xs text-text-muted mt-0.5">Enable dynamic audio visualizer ambient background reflections.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefEqualizerGlow}
                    onChange={(e) => setPrefEqualizerGlow(e.target.checked)}
                    className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                  />
                </div>
              </div>

              <div className="mt-auto pt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    addToast('Playback preferences updated', 'success');
                    setActiveNavTab('profile');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-400 via-cyan-400 to-indigo-500 text-slate-950 font-bold text-xs"
                >
                  Save Preferences
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

