import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Radio,
  Upload,
  Globe,
  Lock,
  Eye,
  ChevronDown,
  Flame,
  ShieldCheck,
  ArrowRight,
  X,
  Check,
} from 'lucide-react';
import { useToastStore } from '../components/ui/Toast';
import { roomService } from '../services/roomService';
import { roomLimitService } from '../services/roomLimitService';
import { adminService, DEFAULT_PLATFORM_SETTINGS } from '../services/adminService';
import { useAuthStore } from '../stores/useAuthStore';
import { VisibilityType, PlaybackPermission } from '../types';

const ROOM_ARTWORK_PRESETS = [
  {
    id: 'vinyl_turntable',
    label: 'Turntable',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'synth_neon',
    label: 'Neon Synth',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'lofi_cafe',
    label: 'Late Night',
    url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'studio_beats',
    label: 'Studio Waves',
    url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'sunset_ambient',
    label: 'Sunset Chill',
    url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'cyber_focus',
    label: 'Cyber Space',
    url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80',
  },
];

export const CreateRoomPage: React.FC = () => {
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);
  const { currentUser, isAuthenticated } = useAuthStore();

  const [platformSettings, setPlatformSettings] = useState(DEFAULT_PLATFORM_SETTINGS);
  
  useEffect(() => {
    adminService.getPlatformSettings().then(setPlatformSettings);
  }, []);

  const usage = roomLimitService.getGuestDailyUsage(
    isAuthenticated,
    platformSettings.guestDailyRoomLimit
  );

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [artwork, setArtwork] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [visibility, setVisibility] = useState<VisibilityType>('public');
  const [playback, setPlayback] = useState<PlaybackPermission>('everyone');
  const [allowChat, setAllowChat] = useState(true);
  const [allowQueue, setAllowQueue] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      addToast('Please upload an image file (PNG, JPG, WEBP)', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast('Image size should be less than 5MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === 'string') {
        setArtwork(e.target.result);
        addToast('Room artwork uploaded!', 'success');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processImageFile(file);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      addToast('Please enter a room name', 'error');
      return;
    }

    if (!usage.canCreate) {
      addToast('Daily guest limit of 5 rooms reached. Please sign in to create unlimited rooms!', 'error');
      navigate('/login?reason=limit&redirect=/create');
      return;
    }

    setIsCreating(true);
    try {
      const room = await roomService.createRoom({
        name: name.trim(),
        description: description.trim() || undefined,
        visibility,
        playbackPermissions: playback,
        allowChat,
        allowQueueAdditions: allowQueue,
        host: currentUser,
        artwork: artwork || undefined,
      });

      // Track guest usage
      roomLimitService.recordCreation(isAuthenticated);

      addToast(`Room "${room.name}" created!`, 'success');
      navigate(`/room/${room.id}`);
    } catch (err: unknown) {
      const e = err as Error;
      addToast(e?.message || 'Failed to create room', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const visibilityOptions = [
    { value: 'public' as const, label: 'Public', icon: Globe, desc: 'Anyone can discover' },
    { value: 'unlisted' as const, label: 'Unlisted', icon: Eye, desc: 'Link only access' },
    { value: 'private' as const, label: 'Private', icon: Lock, desc: 'Invite only' },
  ];

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 pb-24 md:pb-10 relative">
      {/* Ambient background element */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-accent-cyan/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="mb-8 text-center relative z-10">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gradient-premium font-display">
          Create a Room
        </h1>
        <p className="text-sm text-text-secondary mt-2">
          Set up a listening space for you and your friends. Joining rooms is always unlimited!
        </p>
      </div>

      <div className="relative glass-premium rounded-3xl p-6 md:p-8 space-y-6 overflow-hidden">
        {/* Animated Shimmer Top Border */}
        <div className="absolute top-0 left-0 right-0 h-[1px] border-shimmer" />

        {/* Room Creation Allowance Pill */}
        {isAuthenticated ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-emerald/10 border border-accent-emerald/30 text-xs text-accent-emerald font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verified Account · Unlimited room creation active</span>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-surface-elevated/60 border border-border/60 text-xs">
            <div className="flex items-center gap-2 text-text-secondary">
              <Flame className="w-4 h-4 text-accent-amber" />
              <span>
                Daily guest rooms: <strong>{usage.count}/{usage.max}</strong> used today ({usage.remaining} remaining)
              </span>
            </div>
            <Link
              to="/login?redirect=/create"
              className="text-accent-cream hover:underline font-medium flex items-center gap-1 self-start sm:self-auto"
            >
              <span>Sign in for unlimited</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}

        {/* Limit reached alert banner */}
        {!usage.canCreate && (
          <div className="p-4 rounded-2xl bg-accent-crimson/10 border border-accent-crimson/30 space-y-2 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
            <div className="flex items-center gap-2 text-accent-crimson font-bold text-sm">
              <Flame className="w-4 h-4" />
              <span>Daily Guest Limit Reached (5 of 5)</span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              You have used all 5 free guest room creations for today. Sign in or create a free account to unlock unlimited room hosting immediately!
            </p>
            <Link
              to="/login?reason=limit&redirect=/create"
              className="inline-flex items-center gap-2 py-2 px-4 rounded-xl bg-accent-cream text-bg font-bold text-xs hover:bg-white transition-all shadow-[0_0_15px_rgba(234,229,219,0.3)] mt-2"
            >
              <span>Sign In / Create Account</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
        {/* Room Name */}
        <div>
          <label className="block text-[11px] font-bold text-text-secondary mb-1.5 uppercase tracking-widest">
            Room Name
          </label>
          <input
            type="text"
            placeholder="e.g. Late Night Coding"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cream/50 focus:ring-1 focus:ring-accent-cream/30 transition-all shadow-inner"
            maxLength={50}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-[11px] font-bold text-text-secondary mb-1.5 uppercase tracking-widest">
            Description
            <span className="text-text-muted ml-1 font-normal capitalize">(optional)</span>
          </label>
          <textarea
            placeholder="What kind of vibe?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cream/50 focus:ring-1 focus:ring-accent-cream/30 transition-all resize-none shadow-inner"
            maxLength={200}
          />
        </div>

        {/* Artwork Section (Presets First, Compact Dropzone) */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-widest">
              Cover Art
            </label>
            {artwork && (
              <button
                type="button"
                onClick={() => setArtwork('')}
                className="text-[11px] text-accent-crimson hover:text-red-400 flex items-center gap-1 font-bold"
              >
                <X className="w-3 h-3" />
                Reset Cover
              </button>
            )}
          </div>

          {/* Presets First */}
          <div role="radiogroup" aria-label="Cover art presets" className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 mb-3">
            {ROOM_ARTWORK_PRESETS.map((preset) => {
              const isSelected = artwork === preset.url;
              return (
                <button
                  key={preset.id}
                  role="radio"
                  aria-checked={isSelected}
                  type="button"
                  onClick={() => {
                    setArtwork(preset.url);
                    addToast(`Selected "${preset.label}" cover`, 'info');
                  }}
                  className={`relative aspect-video overflow-hidden rounded-xl border transition-all ${
                    isSelected
                      ? 'scale-[1.04] ring-2 ring-accent-cyan border-accent-cyan shadow-lg'
                      : 'border-white/10 opacity-75 hover:opacity-100 hover:border-white/30'
                  }`}
                >
                  <img src={preset.url} alt={preset.label} className="w-full h-full object-cover" />
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-accent-cyan flex items-center justify-center text-black">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Compact Dropzone or Custom Selected Preview */}
          {artwork && !ROOM_ARTWORK_PRESETS.some((p) => p.url === artwork) ? (
            <div className="relative rounded-2xl overflow-hidden border border-white/20 group bg-black/50 shadow-artwork-glow">
              <div className="aspect-[21/9] w-full relative overflow-hidden">
                <img
                  src={artwork}
                  alt="Custom cover preview"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex items-end p-4 justify-between">
                  <div className="flex items-center gap-2 text-white text-xs font-bold drop-shadow-md">
                    <Check className="w-4 h-4 text-accent-emerald" />
                    <span>Custom Artwork Uploaded</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold border border-white/30 backdrop-blur-md transition-all btn-glow"
                  >
                    Change
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border border-dashed rounded-xl py-3 px-4 flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
                isDragging
                  ? 'border-accent-cream bg-accent-cream/5 shadow-inner'
                  : 'border-white/10 hover:border-white/30 bg-black/20 hover:bg-black/40'
              }`}
            >
              <Upload className="w-4 h-4 text-accent-cream" />
              <span className="text-xs text-text-secondary">
                Or <span className="text-accent-cream font-medium underline">upload custom artwork</span> (PNG, JPG &lt; 5MB)
              </span>
            </div>
          )}
        </div>

        {/* Visibility */}
        <div>
          <label className="block text-[11px] font-bold text-text-secondary mb-2.5 uppercase tracking-widest">
            Visibility & Access
          </label>
          <div role="radiogroup" aria-label="Room visibility" className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {visibilityOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = visibility === opt.value;
              return (
                <button
                  key={opt.value}
                  role="radio"
                  aria-checked={isSelected}
                  type="button"
                  onClick={() => setVisibility(opt.value)}
                  className={`flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? 'bg-accent-cream text-black border-accent-cream shadow-[0_0_15px_rgba(234,229,219,0.2)]'
                      : 'bg-black/30 border-white/10 text-text-secondary hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-bold">{opt.label}</span>
                  </div>
                  <span className={`text-[11px] leading-tight ${isSelected ? 'text-black/75 font-medium' : 'text-text-muted'}`}>
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Advanced Settings Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          aria-expanded={showAdvanced}
          className="flex items-center gap-2 text-xs font-medium text-text-muted hover:text-text-secondary transition-colors"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${showAdvanced ? 'rotate-180' : ''}`} />
          <span>More settings</span>
        </button>

        {showAdvanced && (
          <div className="space-y-4 p-4 bg-surface-elevated/30 rounded-2xl border border-border/40">
            {/* Playback Permissions */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">
                Playback Control
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['host_only', 'voting', 'everyone'] as PlaybackPermission[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlayback(p)}
                    className={`px-3 py-2 rounded-xl text-[11px] font-medium uppercase tracking-wider border transition-all ${
                      playback === p
                        ? 'bg-accent-cream text-bg border-accent-cream'
                        : 'bg-surface-elevated text-text-secondary border-border hover:border-border-focus'
                    }`}
                  >
                    {p.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Feature Toggles */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-primary">Allow Chat</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={allowChat}
                  onChange={(e) => setAllowChat(e.target.checked)}
                />
                <div className="w-9 h-5 bg-surface-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-emerald" />
              </label>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-text-primary">Allow Queue Additions</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={allowQueue}
                  onChange={(e) => setAllowQueue(e.target.checked)}
                />
                <div className="w-9 h-5 bg-surface-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-emerald" />
              </label>
            </div>
          </div>
        )}

        {/* Create Button or Prompt to Sign In */}
        {!usage.canCreate ? (
          <Link
            to="/login?reason=limit&redirect=/create"
            className="w-full py-4 rounded-xl font-bold text-sm tracking-widest bg-white text-black flex items-center justify-center gap-2 hover:scale-105 transition-all duration-300 shadow-[0_0_30px_rgba(255,255,255,0.4)] mt-6"
          >
            <span>Sign In to Create Unlimited Rooms</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        ) : (
          <div>
            <button
              aria-describedby="cta-hint"
              className="h-14 w-full rounded-2xl bg-accent-cream font-semibold text-black transition-all duration-300 shadow-[0_0_20px_rgba(234,229,219,0.3)] hover:shadow-[0_0_30px_rgba(234,229,219,0.5)] hover:bg-white active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-white/40 disabled:shadow-none flex items-center justify-center gap-2"
              onClick={handleCreate}
              disabled={!name.trim() || isCreating}
            >
              {isCreating ? (
                <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-black" />
              ) : (
                <>
                  <Radio className="w-5 h-5" />
                  <span>Host a Room</span>
                </>
              )}
            </button>
            {!name.trim() && (
              <p id="cta-hint" className="mt-2 text-center text-xs text-white/50">
                Name your room to continue
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
