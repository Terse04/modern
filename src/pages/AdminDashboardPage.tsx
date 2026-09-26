import React, { useState, useEffect } from 'react';
import {
  Users,
  Radio,
  Music,
  Settings,
  Shield,
  Search,
  Plus,
  Trash2,
  Ban,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  Database,
  Flame,
  Sliders,
  Play,
  Pause,
  UserCheck,
} from 'lucide-react';
import { User, Room, Track, PlatformSettings, VisibilityType } from '../types';
import { adminService } from '../services/adminService';
import { roomLimitService } from '../services/roomLimitService';
import { useToastStore } from '../components/ui/Toast';
import { Link } from 'react-router-dom';
import { AudioUploadModal } from '../components/studio/AudioUploadModal';
import { UploadCloud } from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const addToast = useToastStore((s) => s.addToast);

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'rooms' | 'tracks' | 'settings'>('overview');
  const [loading, setLoading] = useState(true);

  // Data states
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [settings, setSettings] = useState<PlatformSettings>(adminService.getPlatformSettings());

  // Search & filter
  const [userSearch, setUserSearch] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const [trackSearch, setTrackSearch] = useState('');

  // Modals & form states
  const [showAddTrackModal, setShowAddTrackModal] = useState(false);
  const [newTrackTitle, setNewTrackTitle] = useState('');
  const [newTrackArtist, setNewTrackArtist] = useState('');
  const [newTrackAlbum, setNewTrackAlbum] = useState('');
  const [newTrackGenre, setNewTrackGenre] = useState('Lo-Fi / Ambient');
  const [newTrackDuration, setNewTrackDuration] = useState(30);
  const [newTrackAudioUrl, setNewTrackAudioUrl] = useState('/audio/track-1.wav');
  const [newTrackArtwork, setNewTrackArtwork] = useState('https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80');

  // New tag/genre input
  const [newGenreInput, setNewGenreInput] = useState('');
  const [newTagInput, setNewTagInput] = useState('');
  const [showStudioUploadModal, setShowStudioUploadModal] = useState(false);

  const handleStudioTrackUploaded = (newTrack: Track) => {
    setTracks((prev) => [newTrack, ...prev]);
    addToast(`Track "${newTrack.title}" added to catalog`, 'success');
  };

  // Audio preview
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allStats, allUsers, allRooms, allTracks] = await Promise.all([
        adminService.getStats(),
        adminService.getAllUsers(),
        adminService.getAllRooms(),
        adminService.getAllTracks(),
      ]);
      setStats(allStats);
      setUsers(allUsers);
      setRooms(allRooms);
      setTracks(allTracks);
      setSettings(adminService.getPlatformSettings());
    } catch (err) {
      console.error('Failed to load admin data:', err);
      addToast('Failed to load admin data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Stop preview audio when leaving
  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
      }
    };
  }, [audioElement]);

  const handleTogglePreview = (track: Track) => {
    if (previewTrackId === track.id) {
      audioElement?.pause();
      setPreviewTrackId(null);
    } else {
      if (audioElement) audioElement.pause();
      const a = new Audio(track.audioUrl);
      a.play().catch(() => addToast('Audio file unavailable for preview', 'info'));
      a.onended = () => setPreviewTrackId(null);
      setAudioElement(a);
      setPreviewTrackId(track.id);
    }
  };

  // User Actions
  const handleToggleUserBan = async (user: User) => {
    const nextBan = !user.isBanned;
    const ok = await adminService.updateUser(user.id, { isBanned: nextBan });
    if (ok) {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isBanned: nextBan } : u)));
      addToast(`User @${user.username} ${nextBan ? 'banned' : 'unbanned'}`);
    }
  };

  const handleToggleUserAdmin = async (user: User) => {
    const nextAdmin = !user.isAdmin;
    const ok = await adminService.updateUser(user.id, {
      isAdmin: nextAdmin,
      role: nextAdmin ? 'admin' : 'listener',
    });
    if (ok) {
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isAdmin: nextAdmin, role: nextAdmin ? 'admin' : 'listener' } : u))
      );
      addToast(`User @${user.username} role updated to ${nextAdmin ? 'Admin' : 'Listener'}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    const ok = await adminService.deleteUser(userId);
    if (ok) {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      addToast('User deleted successfully');
    }
  };

  // Room Actions
  const handleToggleRoomLive = async (roomId: string, currentLive: boolean) => {
    const nextLive = !currentLive;
    const ok = await adminService.toggleRoomLive(roomId, nextLive);
    if (ok) {
      setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, isLive: nextLive } : r)));
      addToast(`Room marked as ${nextLive ? 'Live' : 'Ended'}`);
    }
  };

  const handleChangeRoomVisibility = async (roomId: string, visibility: VisibilityType) => {
    const ok = await adminService.updateRoomVisibility(roomId, visibility);
    if (ok) {
      setRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, settings: { ...r.settings, visibility } } : r))
      );
      addToast(`Room visibility set to ${visibility}`);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!window.confirm('Delete this room permanently?')) return;
    const ok = await adminService.deleteRoom(roomId);
    if (ok) {
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
      addToast('Room removed');
    }
  };

  // Track Actions
  const handleAddTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrackTitle.trim() || !newTrackArtist.trim()) {
      addToast('Please enter title and artist', 'error');
      return;
    }
    const added = await adminService.addTrack({
      title: newTrackTitle.trim(),
      artist: newTrackArtist.trim(),
      album: newTrackAlbum.trim() || 'Single',
      genre: newTrackGenre,
      duration: Number(newTrackDuration) || 30,
      audioUrl: newTrackAudioUrl.trim(),
      artwork: newTrackArtwork.trim(),
    });
    setTracks((prev) => [added, ...prev]);
    setShowAddTrackModal(false);
    setNewTrackTitle('');
    setNewTrackArtist('');
    addToast(`Added track "${added.title}" to audio library!`, 'success');
  };

  const handleDeleteTrack = async (trackId: string) => {
    if (!window.confirm('Remove this track from library?')) return;
    const ok = await adminService.deleteTrack(trackId);
    if (ok) {
      setTracks((prev) => prev.filter((t) => t.id !== trackId));
      addToast('Track removed from library');
    }
  };

  // Settings Actions
  const handleSaveSettings = () => {
    adminService.updatePlatformSettings(settings);
    addToast('Platform configurations updated!', 'success');
  };

  const handleAddGenre = () => {
    const val = newGenreInput.trim();
    if (!val || settings.availableGenres.includes(val)) return;
    const next = [...settings.availableGenres, val];
    setSettings((s) => ({ ...s, availableGenres: next }));
    setNewGenreInput('');
  };

  const handleRemoveGenre = (genre: string) => {
    const next = settings.availableGenres.filter((g) => g !== genre);
    setSettings((s) => ({ ...s, availableGenres: next }));
  };

  const handleAddTag = () => {
    const val = newTagInput.trim();
    if (!val || settings.availableTags.includes(val)) return;
    const next = [...settings.availableTags, val];
    setSettings((s) => ({ ...s, availableTags: next }));
    setNewTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    const next = settings.availableTags.filter((t) => t !== tag);
    setSettings((s) => ({ ...s, availableTags: next }));
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.username.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredRooms = rooms.filter(
    (r) =>
      r.name.toLowerCase().includes(roomSearch.toLowerCase()) ||
      r.host.name.toLowerCase().includes(roomSearch.toLowerCase())
  );

  const filteredTracks = tracks.filter(
    (t) =>
      t.title.toLowerCase().includes(trackSearch.toLowerCase()) ||
      t.artist.toLowerCase().includes(trackSearch.toLowerCase()) ||
      t.genre?.toLowerCase().includes(trackSearch.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div>
          <div className="flex items-center gap-2 text-accent-cream">
            <Shield className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Control Plane</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary font-display mt-1">
            Admin Dashboard
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Platform governance, user accounts, room moderation, audio catalog, and system limits.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs font-medium text-text-secondary hover:text-text-primary hover:border-border-focus transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>
          <Link
            to="/rooms"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-accent-cream text-bg text-xs font-semibold hover:bg-accent-creamHover transition-colors shadow-glow-subtle"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Go to Live Rooms</span>
          </Link>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border/40">
        {[
          { id: 'overview', label: 'Overview & Health', icon: Sliders },
          { id: 'users', label: `Users (${users.length})`, icon: Users },
          { id: 'rooms', label: `Rooms (${rooms.length})`, icon: Radio },
          { id: 'tracks', label: `Audio Catalog (${tracks.length})`, icon: Music },
          { id: 'settings', label: 'Types & Platform Limits', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-accent-cream text-bg shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─── TAB 1: OVERVIEW ────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-surface-elevated/50 border border-border/60 space-y-2">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-xs font-medium">Total Registered Users</span>
                <Users className="w-4 h-4 text-accent-cream" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-text-primary font-display">
                {stats?.totalUsers ?? users.length}
              </p>
              <p className="text-[11px] text-text-muted">
                {stats?.adminUsers ?? 1} Admins · {stats?.bannedUsers ?? 0} Banned
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-surface-elevated/50 border border-border/60 space-y-2">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-xs font-medium">Active Listening Rooms</span>
                <Radio className="w-4 h-4 text-accent-emerald" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-text-primary font-display">
                {stats?.liveRooms ?? 0}
              </p>
              <p className="text-[11px] text-accent-emerald flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse" />
                {stats?.totalListeners ?? 0} Total Active Listeners
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-surface-elevated/50 border border-border/60 space-y-2">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-xs font-medium">Audio Tracks in Catalog</span>
                <Music className="w-4 h-4 text-accent-amber" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-text-primary font-display">
                {stats?.totalTracks ?? tracks.length}
              </p>
              <p className="text-[11px] text-text-muted">
                {settings.availableGenres.length} Genres configured
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-surface-elevated/50 border border-border/60 space-y-2">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-xs font-medium">Guest Daily Room Limit</span>
                <Flame className="w-4 h-4 text-accent-crimson" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-text-primary font-display">
                {settings.guestDailyRoomLimit}
              </p>
              <p className="text-[11px] text-text-muted">
                Rooms/day · Login required after
              </p>
            </div>
          </div>

          {/* Database Health Card */}
          <div className="p-6 rounded-2xl bg-surface-elevated/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent-emerald/10 border border-accent-emerald/30 flex items-center justify-center text-accent-emerald">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-text-primary">Supabase Database Connection</h3>
                  <span className="px-2 py-0.5 rounded-full bg-accent-emerald/15 text-[10px] text-accent-emerald border border-accent-emerald/30 font-medium">
                    CONNECTED & LIVE
                  </span>
                </div>
                <p className="text-xs text-text-muted mt-0.5">
                  Host: <code className="text-accent-cream">lvudbyfktpymccdskmtf.supabase.co</code> · Realtime Broadcasts Active
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                roomLimitService.resetUsage();
                addToast('Local guest daily usage reset for this browser');
              }}
              className="px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-text-secondary hover:text-text-primary hover:border-border-focus transition-colors"
            >
              Reset My Guest Limit Usage
            </button>
          </div>
        </div>
      )}

      {/* ─── TAB 2: USERS MANAGEMENT ────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative max-w-sm w-full">
              <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search users by name or @username..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full bg-surface-elevated border border-border rounded-xl pl-9 pr-3.5 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
              />
            </div>
            <p className="text-xs text-text-muted">Showing {filteredUsers.length} of {users.length} users</p>
          </div>

          <div className="bg-surface-elevated/40 border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-elevated/80 border-b border-border/60 text-text-muted uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={u.avatar}
                            alt={u.name}
                            className="w-8 h-8 rounded-full object-cover ring-1 ring-white/10"
                          />
                          <div>
                            <div className="font-semibold text-text-primary flex items-center gap-1.5">
                              <span>{u.name}</span>
                              {u.isAdmin && (
                                <span className="px-1.5 py-0.2 rounded bg-accent-cream/20 text-accent-cream text-[9px] font-bold">
                                  ADMIN
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-text-muted">@{u.username}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="capitalize px-2 py-0.5 rounded-lg bg-surface border border-border/60 text-text-secondary text-[11px]">
                          {u.role || (u.isAdmin ? 'admin' : 'listener')}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {u.isBanned ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-crimson/15 text-accent-crimson border border-accent-crimson/30 text-[10px] font-medium">
                            <Ban className="w-2.5 h-2.5" /> Banned
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/30 text-[10px] font-medium">
                            <CheckCircle className="w-2.5 h-2.5" /> Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleUserAdmin(u)}
                            className="p-1.5 rounded-lg bg-surface hover:bg-surface-elevated text-text-muted hover:text-accent-cream transition-colors"
                            title={u.isAdmin ? 'Demote to listener' : 'Promote to Admin'}
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleUserBan(u)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              u.isBanned
                                ? 'bg-accent-crimson/20 text-accent-crimson'
                                : 'bg-surface hover:bg-surface-elevated text-text-muted hover:text-accent-crimson'
                            }`}
                            title={u.isBanned ? 'Unban user' : 'Ban user'}
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-1.5 rounded-lg bg-surface hover:bg-surface-elevated text-text-muted hover:text-accent-crimson transition-colors"
                            title="Delete user"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: ROOMS MANAGEMENT ────────────────────────────────────── */}
      {activeTab === 'rooms' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative max-w-sm w-full">
              <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search rooms by title or host..."
                value={roomSearch}
                onChange={(e) => setRoomSearch(e.target.value)}
                className="w-full bg-surface-elevated border border-border rounded-xl pl-9 pr-3.5 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
              />
            </div>
            <p className="text-xs text-text-muted">Showing {filteredRooms.length} of {rooms.length} rooms</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRooms.map((r) => (
              <div
                key={r.id}
                className="p-4 rounded-2xl bg-surface-elevated/40 border border-border hover:border-border-focus transition-all flex flex-col justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <img
                    src={r.artwork}
                    alt={r.name}
                    className="w-16 h-16 rounded-xl object-cover ring-1 ring-white/10 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-text-primary truncate">{r.name}</h3>
                      {r.isLive ? (
                        <span className="px-1.5 py-0.2 rounded-full bg-accent-emerald/15 text-accent-emerald text-[9px] font-bold border border-accent-emerald/30">
                          LIVE
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded-full bg-text-muted/15 text-text-muted text-[9px] font-bold">
                          ENDED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted truncate mt-0.5">{r.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-text-secondary">
                      <span>Host: <strong>@{r.host.username}</strong></span>
                      <span>•</span>
                      <span>{r.listenerCount} listeners</span>
                    </div>
                  </div>
                </div>

                {/* Room Controls */}
                <div className="flex items-center justify-between pt-3 border-t border-border/40 text-xs">
                  <div className="flex items-center gap-2">
                    <select
                      value={r.settings.visibility}
                      onChange={(e) => handleChangeRoomVisibility(r.id, e.target.value as any)}
                      className="bg-surface border border-border rounded-lg px-2 py-1 text-[11px] text-text-secondary focus:outline-none"
                    >
                      <option value="public">Public</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="private">Private</option>
                    </select>

                    <button
                      onClick={() => handleToggleRoomLive(r.id, r.isLive)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                        r.isLive
                          ? 'border-accent-crimson/30 text-accent-crimson hover:bg-accent-crimson/10'
                          : 'border-accent-emerald/30 text-accent-emerald hover:bg-accent-emerald/10'
                      }`}
                    >
                      {r.isLive ? 'End Stream' : 'Set Live'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      to={`/room/${r.id}`}
                      className="p-1.5 rounded-lg bg-surface hover:bg-surface-elevated text-text-muted hover:text-accent-cream transition-colors"
                      title="Open Room"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                    <button
                      onClick={() => handleDeleteRoom(r.id)}
                      className="p-1.5 rounded-lg bg-surface hover:bg-surface-elevated text-text-muted hover:text-accent-crimson transition-colors"
                      title="Delete Room"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB 4: AUDIO CATALOG ───────────────────────────────────────── */}
      {activeTab === 'tracks' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative max-w-sm w-full">
              <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search tracks by title, artist, or genre..."
                value={trackSearch}
                onChange={(e) => setTrackSearch(e.target.value)}
                className="w-full bg-surface-elevated border border-border rounded-xl pl-9 pr-3.5 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
              />
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={() => setShowStudioUploadModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition shadow-glow-subtle"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Studio Audio Upload</span>
              </button>
              <button
                onClick={() => setShowAddTrackModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-text-primary text-xs font-semibold hover:border-accent-cream transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Manual URL</span>
              </button>
            </div>
          </div>

          <div className="bg-surface-elevated/40 border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-elevated/80 border-b border-border/60 text-text-muted uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Track</th>
                    <th className="py-3 px-4">Genre</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Audio Stream</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredTracks.map((t) => (
                    <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={t.artwork}
                            alt={t.title}
                            className="w-9 h-9 rounded-lg object-cover ring-1 ring-white/10"
                          />
                          <div>
                            <p className="font-semibold text-text-primary">{t.title}</p>
                            <p className="text-[11px] text-text-muted">{t.artist} • {t.album}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-lg bg-surface border border-border/50 text-[11px] text-text-secondary">
                          {t.genre || 'Unspecified'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-text-muted tabular-nums">
                        {Math.floor(t.duration / 60)}:{(t.duration % 60).toString().padStart(2, '0')}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleTogglePreview(t)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] transition-colors ${
                            previewTrackId === t.id
                              ? 'bg-accent-cream text-bg border-accent-cream'
                              : 'bg-surface border-border text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          {previewTrackId === t.id ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                          <span>{previewTrackId === t.id ? 'Playing' : 'Preview'}</span>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteTrack(t.id)}
                          className="p-1.5 rounded-lg bg-surface hover:bg-surface-elevated text-text-muted hover:text-accent-crimson transition-colors"
                          title="Delete track"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 5: TYPES & PLATFORM LIMITS ─────────────────────────────── */}
      {activeTab === 'settings' && (
        <div className="space-y-6 animate-in fade-in duration-200 max-w-4xl">
          {/* Daily Guest Limit Card */}
          <div className="p-6 rounded-2xl bg-surface-elevated/40 border border-border space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <Flame className="w-4 h-4 text-accent-amber" />
                  Daily Guest Room Creation Limit
                </h3>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  Controls how many rooms unauthenticated guests are allowed to create per day. When exceeded, the system automatically prompts login.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-accent-amber/15 text-accent-amber text-xs font-bold border border-accent-amber/30">
                Limit: {settings.guestDailyRoomLimit} / day
              </span>
            </div>

            <div className="flex items-center gap-4">
              <input
                type="number"
                min={1}
                max={50}
                value={settings.guestDailyRoomLimit}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, guestDailyRoomLimit: Math.max(1, parseInt(e.target.value) || 1) }))
                }
                className="w-32 bg-surface border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary focus:outline-none focus:border-border-focus"
              />
              <span className="text-xs text-text-secondary">rooms per day per guest IP / device</span>
            </div>
          </div>

          {/* Max Listeners Card */}
          <div className="p-6 rounded-2xl bg-surface-elevated/40 border border-border space-y-4">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Max Listeners per Room</h3>
              <p className="text-xs text-text-muted mt-1">
                Upper bound capacity for listening rooms before audio queue locks.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min={10}
                max={1000}
                step={10}
                value={settings.maxListenersPerRoom}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, maxListenersPerRoom: parseInt(e.target.value) || 100 }))
                }
                className="w-32 bg-surface border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary focus:outline-none focus:border-border-focus"
              />
              <span className="text-xs text-text-secondary">listeners cap</span>
            </div>
          </div>

          {/* Manage Genres */}
          <div className="p-6 rounded-2xl bg-surface-elevated/40 border border-border space-y-4">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Platform Music Genres</h3>
              <p className="text-xs text-text-muted mt-1">
                The selectable genre types for room categorization and discovery.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {settings.availableGenres.map((genre) => (
                <span
                  key={genre}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-border text-xs text-text-secondary group"
                >
                  <span>{genre}</span>
                  <button
                    onClick={() => handleRemoveGenre(genre)}
                    className="text-text-muted hover:text-accent-crimson transition-colors"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2 max-w-sm">
              <input
                type="text"
                placeholder="New genre (e.g. Ambient Techno)"
                value={newGenreInput}
                onChange={(e) => setNewGenreInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddGenre()}
                className="flex-1 bg-surface border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
              />
              <button
                onClick={handleAddGenre}
                className="px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-text-primary hover:border-accent-cream transition-colors"
              >
                Add Genre
              </button>
            </div>
          </div>

          {/* Manage Tags */}
          <div className="p-6 rounded-2xl bg-surface-elevated/40 border border-border space-y-4">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Platform Room Tags</h3>
              <p className="text-xs text-text-muted mt-1">
                Curator tags used to filter and search rooms.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {settings.availableTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-border text-xs text-text-secondary"
                >
                  <span>#{tag}</span>
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="text-text-muted hover:text-accent-crimson transition-colors"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2 max-w-sm">
              <input
                type="text"
                placeholder="New tag (e.g. Binaural)"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                className="flex-1 bg-surface border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
              />
              <button
                onClick={handleAddTag}
                className="px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-text-primary hover:border-accent-cream transition-colors"
              >
                Add Tag
              </button>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <button
              onClick={handleSaveSettings}
              className="py-3 px-6 rounded-xl bg-accent-cream text-bg font-bold text-xs hover:bg-accent-creamHover transition-colors shadow-glow-subtle"
            >
              Save Platform Settings
            </button>
          </div>
        </div>
      )}

      {/* ─── ADD TRACK MODAL ────────────────────────────────────────────── */}
      {showAddTrackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
            onClick={() => setShowAddTrackModal(false)}
          />
          <div className="relative w-full max-w-md bg-surface border border-border rounded-2xl p-6 shadow-2xl z-10 space-y-4">
            <h2 className="text-base font-bold text-text-primary font-display">Add Audio Track</h2>
            <form onSubmit={handleAddTrack} className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-text-secondary block mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Celestial Orbit"
                  value={newTrackTitle}
                  onChange={(e) => setNewTrackTitle(e.target.value)}
                  className="w-full bg-surface-elevated border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-text-secondary block mb-1">Artist</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Solar Plexus"
                  value={newTrackArtist}
                  onChange={(e) => setNewTrackArtist(e.target.value)}
                  className="w-full bg-surface-elevated border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-text-secondary block mb-1">Album (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Nocturne Horizon"
                  value={newTrackAlbum}
                  onChange={(e) => setNewTrackAlbum(e.target.value)}
                  className="w-full bg-surface-elevated border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-text-secondary block mb-1">Genre</label>
                  <select
                    value={newTrackGenre}
                    onChange={(e) => setNewTrackGenre(e.target.value)}
                    className="w-full bg-surface-elevated border border-border rounded-xl px-2.5 py-2 text-xs text-text-primary focus:outline-none"
                  >
                    {settings.availableGenres.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-text-secondary block mb-1">Duration (sec)</label>
                  <input
                    type="number"
                    value={newTrackDuration}
                    onChange={(e) => setNewTrackDuration(parseInt(e.target.value) || 30)}
                    className="w-full bg-surface-elevated border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-text-secondary block mb-1">Audio Stream URL</label>
                <input
                  type="text"
                  required
                  placeholder="/audio/track-1.wav or CDN URL"
                  value={newTrackAudioUrl}
                  onChange={(e) => setNewTrackAudioUrl(e.target.value)}
                  className="w-full bg-surface-elevated border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-text-secondary block mb-1">Artwork URL</label>
                <input
                  type="text"
                  required
                  value={newTrackArtwork}
                  onChange={(e) => setNewTrackArtwork(e.target.value)}
                  className="w-full bg-surface-elevated border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddTrackModal(false)}
                  className="flex-1 py-2 rounded-xl bg-surface-elevated text-text-secondary text-xs hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-accent-cream text-bg font-bold text-xs hover:bg-accent-creamHover"
                >
                  Add Track
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audio Studio Upload Modal */}
      <AudioUploadModal
        isOpen={showStudioUploadModal}
        onClose={() => setShowStudioUploadModal(false)}
        onUploaded={handleStudioTrackUploaded}
      />
    </div>
  );
};
