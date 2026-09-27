import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Radio,
  Headphones,
  Flame,
  Clock,
  Music,
  Sliders,
  ExternalLink,
  Sparkles,
  Edit3,
  Camera,
} from 'lucide-react';
import { Profile } from '../types';
import { Button } from '../components/ui/Button';
import { useToastStore } from '../components/ui/Toast';
import { useAuthStore } from '../stores/useAuthStore';
import { profileService } from '../services/profileService';
import { EditProfileModal } from '../components/profile/EditProfileModal';

export const ProfilePage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const addToast = useToastStore((s) => s.addToast);
  const currentUser = useAuthStore((s) => s.currentUser);
  const updateCurrentUser = useAuthStore((s) => s.updateCurrentUser);

  const [activeTab, setActiveTab] = useState<'rooms' | 'tracks' | 'friends' | 'preferences'>('rooms');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Settings state with persistence
  const [latencyMode, setLatencyMode] = useState<'ultra-low' | 'balanced' | 'hifi'>(() => {
    try {
      const saved = localStorage.getItem('modern_audio_prefs');
      if (saved) return JSON.parse(saved).latencyMode || 'balanced';
    } catch (_) {}
    return 'balanced';
  });
  const [crossfade, setCrossfade] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('modern_audio_prefs');
      if (saved) return JSON.parse(saved).crossfade ?? 3;
    } catch (_) {}
    return 3;
  });
  const [autoSync, setAutoSync] = useState<boolean>(true);
  const [hapticReactions, setHapticReactions] = useState<boolean>(true);

  const targetUsername = username || currentUser.username;
  const isOwnProfile =
    !username ||
    username.toLowerCase() === 'me' ||
    username.toLowerCase() === currentUser.username.toLowerCase();

  const [profile, setProfile] = useState<Profile>(() => {
    return {
      id: isOwnProfile ? currentUser.id : `usr_${targetUsername}`,
      username: isOwnProfile ? currentUser.username : targetUsername,
      name: isOwnProfile ? currentUser.name : targetUsername,
      bio: 'Music enthusiast exploring shared soundscapes.',
      avatar: isOwnProfile
        ? currentUser.avatar
        : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80',
      currentStatus: 'Ready to listen',
      stats: {
        roomsCreated: 0,
        roomsJoined: 0,
        tracksPlayed: 0,
        listeningStreakDays: 1,
        listeningHours: 0,
      },
      favoriteTracks: [],
      recentRooms: [],
      friends: [],
    };
  });

  // Load latest profile from service
  useEffect(() => {
    let isCancelled = false;
    const loadProfile = async () => {
      const fetched = await profileService.getProfile(targetUsername);
      if (!isCancelled && fetched) {
        if (isOwnProfile) {
          setProfile({
            ...fetched,
            username: currentUser.username,
            name: currentUser.name || fetched.name,
            avatar: currentUser.avatar || fetched.avatar,
          });
        } else {
          setProfile(fetched);
        }
      }
    };
    loadProfile();
    return () => {
      isCancelled = true;
    };
  }, [targetUsername, isOwnProfile, currentUser.username, currentUser.name, currentUser.avatar]);

  const handleSavePreferences = () => {
    try {
      localStorage.setItem(
        'modern_audio_prefs',
        JSON.stringify({
          latencyMode,
          crossfade,
          autoSync,
          hapticReactions,
        })
      );
    } catch (_) {}
    addToast('Audio & sync preferences saved!');
  };

  const handleSaveProfile = async (data: {
    name: string;
    bio: string;
    currentStatus: string;
    avatar: string;
  }) => {
    await profileService.updateProfile(currentUser.username, data);
    updateCurrentUser({
      name: data.name,
      avatar: data.avatar,
    });
    setProfile((prev) => ({
      ...prev,
      name: data.name,
      bio: data.bio,
      currentStatus: data.currentStatus,
      avatar: data.avatar,
    }));
    addToast('Sound identity updated successfully!');
  };

  return (
    <div className="min-h-screen bg-bg text-text-primary pb-24 md:pb-12">
      {/* Profile Header Hero */}
      <div className="relative border-b border-border/40 bg-gradient-to-b from-surface-elevated/40 via-surface/20 to-transparent">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6">
            {/* Avatar with listening pulse and interactive edit trigger */}
            <div className="relative group">
              <div
                onClick={() => isOwnProfile && setIsEditModalOpen(true)}
                className={`w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden border-2 border-border/80 shadow-2xl relative ${
                  isOwnProfile ? 'cursor-pointer hover:border-accent-cream transition-all' : ''
                }`}
              >
                <img
                  src={profile.avatar}
                  alt={profile.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {isOwnProfile && (
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white">
                    <Camera className="w-6 h-6 mb-1 text-accent-cream" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider">Change</span>
                  </div>
                )}
              </div>
              <div className="absolute -bottom-2 -right-2 px-2.5 py-1 rounded-full bg-surface-elevated border border-border text-[11px] font-semibold text-accent-cream flex items-center gap-1 shadow-lg backdrop-blur-md">
                <Sparkles className="w-3 h-3 text-accent-cream" />
                <span>Host</span>
              </div>
            </div>

            {/* Profile Info */}
            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
                  {profile.name}
                </h1>
                <span className="text-sm font-mono text-text-muted">@{profile.username}</span>
              </div>

              {profile.bio && (
                <p className="text-sm text-text-secondary max-w-xl line-clamp-2">
                  {profile.bio}
                </p>
              )}

              {/* Live status badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-emerald/10 border border-accent-emerald/20 text-xs text-accent-emerald font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-ping" />
                <span>{profile.currentStatus}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              {isOwnProfile && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2"
                  onClick={() => setIsEditModalOpen(true)}
                >
                  <Edit3 className="w-4 h-4" />
                  Edit Profile
                </Button>
              )}
              <Link to="/room/late-night-coding">
                <Button variant="primary" size="sm" className="gap-2">
                  <Headphones className="w-4 h-4" />
                  Join Room
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-8 pt-6 border-t border-border/30">
            <div className="bg-surface/50 border border-border/40 rounded-2xl p-3.5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-text-muted text-xs mb-1">
                <Radio className="w-3.5 h-3.5" />
                <span>Rooms Hosted</span>
              </div>
              <p className="text-lg font-bold font-mono text-text-primary">{profile.stats.roomsCreated}</p>
            </div>

            <div className="bg-surface/50 border border-border/40 rounded-2xl p-3.5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-text-muted text-xs mb-1">
                <Headphones className="w-3.5 h-3.5" />
                <span>Rooms Joined</span>
              </div>
              <p className="text-lg font-bold font-mono text-text-primary">{profile.stats.roomsJoined}</p>
            </div>

            <div className="bg-surface/50 border border-border/40 rounded-2xl p-3.5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-text-muted text-xs mb-1">
                <Music className="w-3.5 h-3.5" />
                <span>Tracks Played</span>
              </div>
              <p className="text-lg font-bold font-mono text-text-primary">{profile.stats.tracksPlayed}</p>
            </div>

            <div className="bg-surface/50 border border-border/40 rounded-2xl p-3.5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-text-muted text-xs mb-1">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                <span>Streak</span>
              </div>
              <p className="text-lg font-bold font-mono text-orange-400">{profile.stats.listeningStreakDays} days</p>
            </div>

            <div className="bg-surface/50 border border-border/40 rounded-2xl p-3.5 text-center col-span-2 sm:col-span-1">
              <div className="flex items-center justify-center gap-1.5 text-text-muted text-xs mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Hours Listened</span>
              </div>
              <p className="text-lg font-bold font-mono text-text-primary">{profile.stats.listeningHours}h</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6">
        <div className="flex items-center gap-2 border-b border-border/40 pb-3 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('rooms')}
            className={`px-4 py-2 rounded-xl text-xs font-medium uppercase tracking-wider transition-all ${
              activeTab === 'rooms'
                ? 'bg-surface-elevated text-text-primary border border-border'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Recent Rooms ({profile.recentRooms.length})
          </button>
          <button
            onClick={() => setActiveTab('tracks')}
            className={`px-4 py-2 rounded-xl text-xs font-medium uppercase tracking-wider transition-all ${
              activeTab === 'tracks'
                ? 'bg-surface-elevated text-text-primary border border-border'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Favorite Tracks ({profile.favoriteTracks.length})
          </button>
          <button
            onClick={() => setActiveTab('friends')}
            className={`px-4 py-2 rounded-xl text-xs font-medium uppercase tracking-wider transition-all ${
              activeTab === 'friends'
                ? 'bg-surface-elevated text-text-primary border border-border'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Listening Circle ({profile.friends.length})
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`px-4 py-2 rounded-xl text-xs font-medium uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeTab === 'preferences'
                ? 'bg-surface-elevated text-text-primary border border-border'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Audio & Sync
          </button>
        </div>

        {/* Tab 1: Recent Rooms */}
        {activeTab === 'rooms' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-6">
            {profile.recentRooms.map((room) => (
              <div
                key={room.id}
                className="group relative overflow-hidden rounded-2xl border border-border/40 hover:border-border-focus bg-surface p-4 transition-all duration-300"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 relative">
                    <img
                      src={room.artwork}
                      alt={room.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-text-primary text-sm truncate">{room.name}</h3>
                    <p className="text-xs text-text-muted mt-1">{room.lastVisited}</p>
                    <Link
                      to={`/room/${room.id}`}
                      className="inline-flex items-center gap-1 text-xs text-accent-cream font-medium mt-2 hover:underline"
                    >
                      <span>Jump in</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: Favorite Tracks */}
        {activeTab === 'tracks' && (
          <div className="space-y-2 mt-6">
            {profile.favoriteTracks.map((track, idx) => (
              <div
                key={track.id}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-surface/60 border border-border/40 hover:border-border-focus transition-all"
              >
                <div className="flex items-center gap-3.5">
                  <span className="text-xs font-mono text-text-muted w-5 text-center">{idx + 1}</span>
                  <img
                    src={track.artwork}
                    alt={track.title}
                    className="w-12 h-12 rounded-xl object-cover"
                  />
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{track.title}</p>
                    <p className="text-xs text-text-secondary">{track.artist} • {track.album}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono text-text-muted">
                  <span className="px-2 py-0.5 rounded-md bg-surface-elevated border border-border text-[10px]">
                    {track.genre || 'Soundtrack'}
                  </span>
                  <span>{Math.floor(track.duration / 60)}:{String(track.duration % 60).padStart(2, '0')}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Friends / Listening Circle */}
        {activeTab === 'friends' && (
          <div>
            {profile.friends.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-border/70 text-center space-y-2 mt-6">
                <p className="text-sm font-semibold text-text-primary">No listening friends yet</p>
                <p className="text-xs text-text-muted">
                  Share your room links with friends to start listening and synchronizing soundscapes together!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                {profile.friends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between p-4 rounded-2xl bg-surface/60 border border-border/40 hover:border-border-focus transition-all"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="relative">
                        <img
                          src={friend.avatar}
                          alt={friend.name}
                          className="w-12 h-12 rounded-full object-cover border border-border"
                        />
                        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-accent-emerald border-2 border-surface" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{friend.name}</p>
                        <p className="text-xs text-accent-cream/90 flex items-center gap-1 mt-0.5">
                          <Headphones className="w-3 h-3" />
                          {friend.statusText}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Audio & Sync Preferences */}
        {activeTab === 'preferences' && (
          <div className="max-w-2xl space-y-6 mt-6 bg-surface/40 p-6 rounded-3xl border border-border/40">
            <div>
              <h2 className="text-base font-semibold text-text-primary mb-1">Playback Synchronization Engine</h2>
              <p className="text-xs text-text-muted">Tune your client clock sync, latency buffering, and audio transition parameters.</p>
            </div>

            {/* Sync Mode */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary block mb-2">
                Clock Drift Optimization
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'ultra-low', label: 'Ultra Low', desc: '< 20ms' },
                  { id: 'balanced', label: 'Balanced', desc: '~ 50ms smooth' },
                  { id: 'hifi', label: 'Hi-Fi Buffer', desc: 'No micro-stutters' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setLatencyMode(mode.id as any)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      latencyMode === mode.id
                        ? 'bg-accent-cream text-bg border-accent-cream'
                        : 'bg-surface-elevated text-text-secondary border-border hover:border-border-focus'
                    }`}
                  >
                    <div className="text-xs font-semibold">{mode.label}</div>
                    <div className={`text-[10px] ${latencyMode === mode.id ? 'text-bg/80' : 'text-text-muted'}`}>
                      {mode.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Crossfade Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Crossfade Duration
                </label>
                <span className="text-xs font-mono text-accent-cream">{crossfade}s</span>
              </div>
              <input
                type="range"
                min="0"
                max="8"
                step="0.5"
                value={crossfade}
                onChange={(e) => setCrossfade(parseFloat(e.target.value))}
                className="w-full accent-accent-cream h-1.5 bg-surface-elevated rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-text-muted mt-1">
                <span>0s (Instant)</span>
                <span>4s</span>
                <span>8s (Ambient blend)</span>
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-4 pt-4 border-t border-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">Sub-frame Auto-Correction</p>
                  <p className="text-xs text-text-muted">Silently adjust Web Audio playbackRate when drift exceeds threshold</p>
                </div>
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e) => setAutoSync(e.target.checked)}
                  className="w-4 h-4 accent-accent-cream rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">Haptic Room Reactions</p>
                  <p className="text-xs text-text-muted">Vibrate device subtly when listeners in the room burst emojis</p>
                </div>
                <input
                  type="checkbox"
                  checked={hapticReactions}
                  onChange={(e) => setHapticReactions(e.target.checked)}
                  className="w-4 h-4 accent-accent-cream rounded cursor-pointer"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button variant="primary" onClick={handleSavePreferences}>
                Save Preferences
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {isOwnProfile && (
        <EditProfileModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          initialName={profile.name}
          initialBio={profile.bio || ''}
          initialStatus={profile.currentStatus}
          initialAvatar={profile.avatar}
          onSave={handleSaveProfile}
        />
      )}
    </div>
  );
};
