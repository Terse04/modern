import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Shuffle,
  MessageCircle,
  ListMusic,
  ThumbsUp,
  Send,
  Trash2,
} from 'lucide-react';
import { Room, RoomMember, QueueItem, ChatMessage, FloatingReaction, Track } from '../types';
import { roomService } from '../services/roomService';
import { usePlaybackStore } from '../stores/usePlaybackStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useRealtimeRoom } from '../hooks/useRealtimeRoom';
import { AuthModal } from '../components/auth/AuthModal';
import { RoomHeader } from '../components/room/RoomHeader';
import { OrbitingParticipants } from '../components/room/OrbitingParticipants';
import { AudioVisualizer, AuraModeSelector, VisualizerMode } from '../components/room/AudioVisualizer';
import { ReactionOverlay } from '../components/room/ReactionOverlay';
import { ShareInviteModal } from '../components/room/ShareInviteModal';
import { RoomSettingsModal } from '../components/room/RoomSettingsModal';
import { SyncControlHUD } from '../components/room/SyncControlHUD';
import { AudioUploadModal } from '../components/studio/AudioUploadModal';
import { BottomSheet } from '../components/ui/BottomSheet';
import { useToastStore } from '../components/ui/Toast';
import { Sparkles } from 'lucide-react';

const REACTION_EMOJIS = ['🔥', '❤️', '🎵', '👏', '😍', '🤘', '💜', '✨'];

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export const RoomPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);

  // Room data
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // Auth identity
  const currentUser = useAuthStore((s) => s.currentUser);
  const [showAuth, setShowAuth] = useState(false);

  // UI panels
  const [showInvite, setShowInvite] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [auraMode, setAuraMode] = useState<VisualizerMode>('spectrum');

  // Playback store
  const {
    currentTrack,
    status,
    position,
    duration,
    volume,
    isMuted,
    isShuffled,
    isRepeating,
    initRoom,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
    nextTrack,
    previousTrack,
    setIsHost,
    skipVotes,
    voteSkip,
  } = usePlaybackStore();

  const [showUploadModal, setShowUploadModal] = useState(false);
  const isHostUser = Boolean(room && (room.host.id === currentUser.id || currentUser.isAdmin));

  const skipThreshold = Math.max(1, Math.ceil(members.length / 2));
  const hasVotedToSkip = skipVotes.includes(currentUser.id);

  const handleSkipAction = () => {
    if (isHostUser) {
      nextTrack(queue);
      addToast('Track skipped (Host Override)', 'info');
    } else {
      voteSkip(currentUser.id, members.length, queue);
      addToast('Voted to skip current track', 'info');
    }
  };

  const chatEndRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // ─── Realtime sync hook ────────────────────────────────────────────────────
  const { broadcastChat, broadcastReaction, broadcastQueueUpdate, joinAsCurrentUser } =
    useRealtimeRoom(roomId, {
      onChatMessage: useCallback((msg: ChatMessage) => {
        setChatMessages((prev) => [...prev, msg]);
      }, []),
      onFloatingReaction: useCallback((reaction: FloatingReaction) => {
        setFloatingReactions((prev) => [...prev, reaction]);
        setTimeout(() => {
          setFloatingReactions((prev) => prev.filter((r) => r.id !== reaction.id));
        }, 3000);
      }, []),
      onQueueUpdate: useCallback((queue: QueueItem[]) => {
        setQueue(queue);
      }, []),
      onMemberUpdate: useCallback((member: RoomMember) => {
        setMembers((prev) => {
          const exists = prev.some((m) => m.user.id === member.user.id);
          if (exists) return prev.map((m) => (m.user.id === member.user.id ? member : m));
          return [member, ...prev];
        });
      }, []),
      onMemberLeft: useCallback((userId: string) => {
        setMembers((prev) => prev.filter((m) => m.user.id !== userId));
      }, []),
      onPresenceSync: useCallback((liveMembers: RoomMember[]) => {
        if (liveMembers.length > 0) {
          setMembers(liveMembers);
        }
      }, []),
    });

  // Load room
  useEffect(() => {
    if (!roomId) return;

    const loadRoom = async () => {
      setLoading(true);
      const fetchedRoom = await roomService.getRoomById(roomId);
      if (!fetchedRoom) {
        addToast('Room not found', 'error');
        navigate('/');
        return;
      }
      setRoom(fetchedRoom);
      const fetchedMembers = await roomService.getRoomMembers(roomId);
      setMembers(fetchedMembers);
      const fetchedQueue = await roomService.getRoomQueue(roomId);
      setQueue(fetchedQueue);
      setChatMessages([]);
      setLoading(false);
    };

    loadRoom();
  }, [roomId, navigate, addToast]);

  // Sync Host identity to store
  useEffect(() => {
    setIsHost(isHostUser);
  }, [isHostUser, setIsHost]);

  // Host sync heartbeat removed as it's now handled by the server state
  // We can just keep the effect signature without broadcastHeartbeat if needed,
  // or remove it entirely. Let's remove the heartbeat interval.
  useEffect(() => {
    // Handled authoritatively by room_playback now
  }, [isHostUser, status, room]);

  // Init playback
  useEffect(() => {
    if (!roomId || !room) return;
    const cleanup = initRoom(roomId, room.currentTrack, isHostUser);
    return cleanup;
  }, [roomId, room, initRoom, isHostUser]);

  // Broadcast presence when room is ready
  useEffect(() => {
    if (!room || loading) return;
    joinAsCurrentUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, loading]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Progress bar seek
  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressRef.current || !duration) return;
      const rect = progressRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      seek(ratio * duration);
    },
    [duration, seek]
  );

  // Send chat — optimistic local update + broadcast
  const handleSendChat = useCallback(() => {
    const text = chatInput.trim();
    if (!text || !roomId) return;
    const msg: ChatMessage = {
      id: `msg_${Date.now()}`,
      roomId,
      user: currentUser,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    // Optimistic local update
    setChatMessages((prev) => [...prev, msg]);
    setChatInput('');
    // Broadcast to other tabs / users
    broadcastChat(msg);
  }, [chatInput, roomId, broadcastChat, currentUser]);

  // Send reaction — optimistic local update + broadcast
  const handleReaction = useCallback(
    (emoji: string) => {
      const reaction: FloatingReaction = {
        id: `r_${Date.now()}_${Math.random()}`,
        emoji,
        userId: currentUser.id,
        userName: currentUser.name,
        userAvatar: currentUser.avatar,
        x: 20 + Math.random() * 60,
      };
      // Optimistic local
      setFloatingReactions((prev) => [...prev, reaction]);
      setTimeout(() => {
        setFloatingReactions((prev) => prev.filter((r) => r.id !== reaction.id));
      }, 3000);
      // Broadcast to other tabs / users
      broadcastReaction(reaction);
    },
    [broadcastReaction, currentUser]
  );

  // Vote queue — optimistic local update + broadcast
  const handleVote = useCallback(
    async (itemId: string) => {
      if (!roomId) return;
      const updated = await roomService.voteQueueItem(roomId, itemId);
      if (updated) {
        setQueue((prev) => {
          const next = prev.map((q) =>
            q.id === itemId ? { ...q, votes: updated.votes, hasVoted: updated.hasVoted } : q
          );
          // Broadcast updated queue so other tabs re-sort
          broadcastQueueUpdate(next);
          return next;
        });
      }
    },
    [roomId, broadcastQueueUpdate]
  );

  const handleTrackUploaded = (newTrack: Track) => {
    const newItem: QueueItem = {
      id: `qi_${Date.now()}`,
      roomId: roomId || '',
      track: newTrack,
      addedBy: currentUser,
      votes: 1,
      hasVoted: true,
      addedAt: new Date().toISOString(),
    };
    const updatedQueue = [...queue, newItem];
    setQueue(updatedQueue);
    broadcastQueueUpdate(updatedQueue);
    addToast(`Added "${newTrack.title}" to room queue`, 'success');
  };

  const handlePlayNext = async (itemId: string) => {
    if (!roomId) return;
    const revision = usePlaybackStore.getState().revision;
    const { supabase, isSupabaseConfigured } = await import('../lib/supabaseClient');
    if (isSupabaseConfigured && supabase) {
      await supabase.rpc('play_next', { p_room_id: roomId, p_queue_item_id: itemId, p_expected_revision: revision });
    }
  };

  const handleRemoveQueueItem = (itemId: string) => {
    const newQueue = queue.filter((q) => q.id !== itemId);
    setQueue(newQueue);
    broadcastQueueUpdate(newQueue);
    addToast('Removed from queue', 'info');
  };

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (loading || !room) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="w-10 h-10 border-3 border-accent-cream border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4 bg-bg">
        <h2 className="text-2xl font-bold text-text-primary mb-2 font-display">Join the Party</h2>
        <p className="text-text-secondary mb-6 max-w-sm">
          Sign in to join live rooms, listen along with friends, and add tracks to the queue.
        </p>
        <button
          onClick={() => setShowAuth(true)}
          className="px-6 py-2.5 bg-accent-cream text-bg rounded-full font-semibold hover:bg-accent-creamHover transition-colors shadow-glow-subtle"
        >
          Sign In
        </button>
        <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
      </div>
    );
  }

  const track = currentTrack || room.currentTrack;

  return (
    <div className="flex-1 h-full flex flex-col bg-bg relative overflow-hidden select-none">
      {/* Ambient background glow from artwork */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full filter blur-[200px] opacity-[0.06]"
          style={{ background: `url(${track?.artwork})`, backgroundSize: 'cover' }}
        />
      </div>

      {/* Room Header */}
      <RoomHeader
        room={room}
        listenerCount={Math.max(1, members.length)}
        onOpenInvite={() => setShowInvite(true)}
        onOpenSettings={() => setShowSettings(true)}
        onOpenAuth={() => setShowAuth(true)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-start relative z-10 px-4 pt-2 pb-3 sm:pt-3 sm:pb-4 max-w-5xl mx-auto w-full min-h-0 gap-3 sm:gap-4 overflow-y-auto">
        {/* Center Stage: Artwork + Orbiting Participants */}
        <div className="relative w-full max-w-[200px] sm:max-w-[230px] md:max-w-[260px] lg:max-w-[290px] mx-auto flex-shrink-0">
          {/* Orbiting Participants (Desktop) */}
          <OrbitingParticipants members={members} isMobile={false} />

          {/* Audio Visualizer Aura & Spectrum Ring */}
          <AudioVisualizer isPlaying={status === 'playing'} artworkUrl={track?.artwork || room.artwork} mode={auraMode} />

          {/* Album Artwork */}
          <div className="relative aspect-square rounded-2xl overflow-hidden shadow-artwork-glow border border-border/30 group z-10">
            <img
              src={track?.artwork || room.artwork}
              alt={track?.title || room.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Reaction Overlay */}
          <ReactionOverlay reactions={floatingReactions} />
        </div>

        {/* Mobile Participants Row */}
        <div className="md:hidden w-full flex-shrink-0 -mt-1">
          <OrbitingParticipants members={members} isMobile={true} />
        </div>

        {/* Bottom Stage: Track Info + Aura Selector + Progress + Controls */}
        <div className="w-full flex flex-col items-center gap-2 sm:gap-2.5 flex-shrink-0 pb-safe">
          {/* Track Info */}
          <div className="text-center space-y-0.5">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-text-primary font-display">
              {track?.title || 'No Track'}
            </h2>
            <p className="text-xs text-text-secondary">{track?.artist || 'Unknown Artist'}</p>
          </div>

          {/* Synced Badge, Live pill & Visualizer Aura Mode */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <SyncControlHUD hostName={room.host.name} isHostUser={isHostUser} />

            {/* Live sync pill */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-emerald/10 border border-accent-emerald/25 text-[11px] font-medium text-accent-emerald">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse" />
              Live · {members.length} listener{members.length !== 1 ? 's' : ''}
            </span>

            <AuraModeSelector mode={auraMode} onChange={setAuraMode} />
          </div>

        {/* Progress Bar */}
        <div className="w-full max-w-lg mx-auto space-y-1.5 px-2">
          <div
            ref={progressRef}
            className="relative h-1.5 bg-white/10 rounded-full cursor-pointer group"
            onClick={handleProgressClick}
          >
            <div
              className="absolute inset-y-0 left-0 bg-accent-cream rounded-full transition-[width] duration-100"
              style={{ width: `${duration > 0 ? (position / duration) * 100 : 0}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-accent-cream rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `${duration > 0 ? (position / duration) * 100 : 0}%`, transform: 'translate(-50%, -50%)' }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-text-muted tabular-nums">
            <span>{formatTime(position)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-3 sm:gap-5">
          <button
            onClick={toggleShuffle}
            className={`p-2 rounded-full transition-colors ${
              isShuffled ? 'text-accent-cream bg-accent-cream/10' : 'text-text-muted hover:text-text-secondary'
            }`}
            title="Shuffle"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            onClick={() => previousTrack(queue)}
            className="p-2.5 text-text-secondary hover:text-text-primary transition-colors"
            title="Previous"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          <button
            onClick={togglePlay}
            className="w-14 h-14 flex items-center justify-center bg-accent-cream text-bg rounded-full hover:bg-accent-creamHover shadow-glow-subtle transition-all active:scale-95"
            title={status === 'playing' ? 'Pause' : 'Play'}
          >
            {status === 'playing' ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
          </button>

          <div className="relative">
            <button
              onClick={handleSkipAction}
              className={`p-2.5 transition-colors relative ${
                hasVotedToSkip
                  ? 'text-accent-cream'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              title={
                isHostUser
                  ? 'Skip Track (Host Override)'
                  : hasVotedToSkip
                  ? `You voted to skip (${skipVotes.length}/${skipThreshold})`
                  : `Vote to Skip Track (${skipVotes.length}/${skipThreshold} votes)`
              }
            >
              <SkipForward className="w-5 h-5" />
              {!isHostUser && skipVotes.length > 0 && (
                <span className="absolute -top-1 -right-1.5 px-1.5 py-0.2 rounded-full bg-violet-600 text-white text-[9px] font-bold shadow-md animate-pulse">
                  {skipVotes.length}/{skipThreshold}
                </span>
              )}
            </button>
          </div>

          <button
            onClick={toggleRepeat}
            className={`p-2 rounded-full transition-colors ${
              isRepeating ? 'text-accent-cream bg-accent-cream/10' : 'text-text-muted hover:text-text-secondary'
            }`}
            title="Repeat"
          >
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        {/* Volume + Utility Bar */}
        <div className="flex items-center justify-center gap-4 sm:gap-6">
          <button
            onClick={toggleMute}
            className="p-2 text-text-muted hover:text-text-secondary transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-24 sm:w-32"
          />

          <div className="w-px h-5 bg-border" />

          {/* Reaction Picker */}
          <div className="flex items-center gap-1">
            {REACTION_EMOJIS.slice(0, 4).map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className="text-lg hover:scale-125 active:scale-90 transition-transform p-1"
                title={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-border" />

          {/* Chat toggle */}
          <button
            onClick={() => setShowChat(true)}
            className="p-2 text-text-muted hover:text-text-secondary transition-colors relative"
            title="Chat"
          >
            <MessageCircle className="w-4 h-4" />
            {chatMessages.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-accent-emerald rounded-full" />
            )}
          </button>

          {/* Queue toggle */}
          <button
            onClick={() => setShowQueue(true)}
            className="p-2 text-text-muted hover:text-text-secondary transition-colors"
            title="Queue"
          >
            <ListMusic className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

      {/* Chat Bottom Sheet */}
      <BottomSheet isOpen={showChat} onClose={() => setShowChat(false)} title="Chat">
        <div className="flex flex-col h-full max-h-[60vh]">
          <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
            {chatMessages.map((msg) =>
              msg.isSystem ? (
                <div key={msg.id} className="flex justify-center py-1.5">
                  <span className="text-[11px] text-text-muted bg-surface-elevated/60 px-3 py-1 rounded-full border border-border/50">
                    {msg.text}
                  </span>
                </div>
              ) : (
                <div key={msg.id} className="flex items-start gap-2.5 group">
                  <img
                    src={msg.user.avatar}
                    alt={msg.user.name}
                    className="w-7 h-7 rounded-full object-cover ring-1 ring-white/10 flex-shrink-0 mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-text-primary">
                        {msg.user.name}
                      </span>
                      <span className="text-[10px] text-text-muted">{msg.timestamp}</span>
                    </div>
                    <p className="text-sm text-text-secondary mt-0.5 leading-relaxed">{msg.text}</p>
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {msg.reactions.map((r, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-elevated/60 border border-border/50 text-xs"
                          >
                            {r.emoji}
                            <span className="text-text-muted">{r.count}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <div className="flex items-center gap-2 pt-3 border-t border-border/50">
            <input
              type="text"
              placeholder="Send a message..."
              className="flex-1 bg-surface-elevated border border-border rounded-full px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
            />
            <button
              onClick={handleSendChat}
              disabled={!chatInput.trim()}
              className="p-2.5 bg-accent-cream text-bg rounded-full hover:bg-accent-creamHover transition-colors disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Queue Bottom Sheet */}
      <BottomSheet isOpen={showQueue} onClose={() => setShowQueue(false)} title="Up Next">
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-text-muted">{queue.length} track{queue.length !== 1 ? 's' : ''} in room queue</span>
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/40 text-violet-300 hover:text-white text-xs font-semibold transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span>+ Upload & Add Audio</span>
            </button>
          </div>

          <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {queue.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                  item.track.id === currentTrack?.id
                    ? 'bg-accent-cream/5 border border-accent-cream/20'
                    : 'bg-surface-elevated/50 border border-border/40 hover:border-border-focus'
                }`}
              >
                <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    src={item.track.artwork}
                    alt={item.track.title}
                    className="w-full h-full object-cover"
                  />
                  {item.track.id === currentTrack?.id && status === 'playing' && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="flex items-end gap-0.5 h-3">
                        <div className="w-0.5 bg-accent-cream animate-pulse" style={{ height: '60%', animationDelay: '0ms' }} />
                        <div className="w-0.5 bg-accent-cream animate-pulse" style={{ height: '100%', animationDelay: '150ms' }} />
                        <div className="w-0.5 bg-accent-cream animate-pulse" style={{ height: '40%', animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-text-primary truncate">{item.track.title}</h4>
                  <p className="text-xs text-text-muted truncate">{item.track.artist}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    Added by @{item.addedBy.username}
                  </p>
                </div>

                {/* Host Reorder Controls */}
                {isHostUser && (
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => handlePlayNext(item.id)}
                      className="p-1 text-text-muted hover:text-accent-cream transition"
                      title="Play Next"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveQueueItem(item.id)}
                      className="p-1 text-text-muted hover:text-rose-400 transition"
                      title="Remove Track"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <button
                  onClick={() => handleVote(item.id)}
                  className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg border transition-colors ${
                    item.hasVoted
                      ? 'bg-accent-cream/10 border-accent-cream/30 text-accent-cream'
                      : 'bg-surface-elevated border-border text-text-muted hover:text-text-secondary hover:border-border-focus'
                  }`}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-semibold tabular-nums">{item.votes}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </BottomSheet>

      {/* Modals */}
      <ShareInviteModal isOpen={showInvite} onClose={() => setShowInvite(false)} room={room} />
      <RoomSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        room={room}
        onSettingsUpdated={(updated) => setRoom(updated)}
      />
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
      <AudioUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploaded={handleTrackUploaded}
      />
    </div>
  );
};
