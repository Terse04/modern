import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Radio, Upload, Globe, Lock, Eye, ChevronDown, Flame, ShieldCheck, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useToastStore } from '../components/ui/Toast';
import { roomService } from '../services/roomService';
import { roomLimitService } from '../services/roomLimitService';
import { adminService } from '../services/adminService';
import { useAuthStore } from '../stores/useAuthStore';
import { VisibilityType, PlaybackPermission } from '../types';

export const CreateRoomPage: React.FC = () => {
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);
  const { currentUser, isAuthenticated } = useAuthStore();

  const platformSettings = adminService.getPlatformSettings();
  const usage = roomLimitService.getGuestDailyUsage(
    isAuthenticated,
    platformSettings.guestDailyRoomLimit
  );

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<VisibilityType>('public');
  const [playback, setPlayback] = useState<PlaybackPermission>('everyone');
  const [allowChat, setAllowChat] = useState(true);
  const [allowQueue, setAllowQueue] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
      });

      // Track guest usage
      roomLimitService.recordCreation(isAuthenticated);

      addToast(`Room "${room.name}" created!`, 'success');
      navigate(`/room/${room.id}`);
    } catch {
      addToast('Failed to create room', 'error');
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
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-10 pb-24 md:pb-10">
      <div className="mb-6 space-y-3">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-display uppercase">
          Create a Room
        </h1>
        <p className="text-sm text-text-secondary">
          Set up a listening space for you and your friends. Joining rooms is always unlimited!
        </p>

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
          <div className="p-4 rounded-xl bg-accent-crimson/15 border border-accent-crimson/40 space-y-2">
            <div className="flex items-center gap-2 text-accent-crimson font-bold text-xs">
              <Flame className="w-4 h-4" />
              <span>Daily Guest Limit Reached (5 of 5 rooms created today)</span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              You have used all 5 free guest room creations for today. Sign in or create a free account to unlock unlimited room hosting immediately!
            </p>
            <Link
              to="/login?reason=limit&redirect=/create"
              className="inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg bg-accent-cream text-bg font-bold text-xs hover:bg-accent-creamHover transition-colors mt-1"
            >
              <span>Sign In / Create Account</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* Room Name */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">
            Room Name
          </label>
          <input
            type="text"
            placeholder="e.g. Late Night Coding"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-surface-elevated border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus transition-colors"
            maxLength={50}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">
            Description
            <span className="text-text-muted ml-1">(optional)</span>
          </label>
          <textarea
            placeholder="What kind of vibe?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full bg-surface-elevated border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus transition-colors resize-none"
            maxLength={200}
          />
        </div>

        {/* Artwork Upload Zone */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">
            Artwork Upload
          </label>
          <div className="border-2 border-dashed border-border rounded-2xl p-8 flex flex-col items-center justify-center gap-3 hover:border-border-focus transition-colors cursor-pointer group">
            <div className="w-12 h-12 rounded-full bg-surface-elevated border border-border flex items-center justify-center group-hover:bg-surface-hover transition-colors">
              <Upload className="w-5 h-5 text-text-muted" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-text-primary">Drag and drop zone</p>
              <p className="text-xs text-text-muted mt-0.5">or click to browse</p>
            </div>
          </div>
        </div>

        {/* Visibility */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-2.5 uppercase tracking-wider">
            Visibility / Public
          </label>
          <div className="grid grid-cols-3 gap-2">
            {visibilityOptions.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => setVisibility(opt.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                    visibility === opt.value
                      ? 'bg-accent-cream/10 border-accent-cream/40 text-accent-cream'
                      : 'bg-surface-elevated border-border text-text-secondary hover:border-border-focus'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-medium">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Advanced Settings Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-xs font-medium text-text-muted hover:text-text-secondary transition-colors"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          More settings →
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
            className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide bg-accent-cream text-bg flex items-center justify-center gap-2 hover:bg-accent-creamHover transition-all shadow-glow-subtle"
          >
            <span>Sign In to Create Unlimited Rooms</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        ) : (
          <Button
            variant="primary"
            size="lg"
            className="w-full py-3.5 rounded-xl font-bold text-base tracking-wide"
            onClick={handleCreate}
            isLoading={isCreating}
            disabled={!name.trim()}
          >
            <Radio className="w-5 h-5" />
            Create room
          </Button>
        )}
      </div>
    </div>
  );
};
