import { create } from 'zustand';
import { Track, PlaybackStatus, DriftMetrics, SyncEvent, QueueItem } from '../types';
import { globalAudioEngine } from '../lib/AudioPlayer';
import { realtimeService } from '../services/realtimeService';
import { CURATED_OPEN_TRACKS } from '../services/openMusicService';
import { useAuthStore } from './useAuthStore';
import { trackService } from '../services/trackService';

interface PlaybackStore {
  currentRoomId: string | null;
  currentTrack: Track | null;
  status: PlaybackStatus;
  position: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffled: boolean;
  isRepeating: boolean;
  isHost: boolean;
  isSoloMode: boolean; // if true, listener's playback is detached from host broadcast
  revision: number;
  serverTimestamp: number;
  driftMetrics: DriftMetrics;
  lastHeartbeat?: {
    trackId: string;
    position: number;
    status: PlaybackStatus;
    serverTimestamp: number;
  };

  skipVotes: string[];

  // Actions
  setIsHost: (isHost: boolean) => void;
  toggleSoloMode: () => void;
  voteSkip: (userId: string, totalMembers: number, queue: QueueItem[]) => void;
  resetSkipVotes: () => void;
  initRoom: (roomId: string, initialTrack?: Track, isHostUser?: boolean) => () => void;
  setTrack: (track: Track, autoPlay?: boolean, broadcast?: boolean) => void;
  play: (broadcast?: boolean) => Promise<void>;
  pause: (broadcast?: boolean) => void;
  togglePlay: () => void;
  seek: (seconds: number, broadcast?: boolean) => void;
  resyncNow: () => void;
  nextTrack: (queue: QueueItem[]) => void;
  previousTrack: (queue: QueueItem[]) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  syncFromRemoteEvent: (event: SyncEvent) => Promise<void>;
  broadcastHeartbeat: () => void;
}

function getCurrentUserId(): string {
  try {
    return useAuthStore.getState().currentUser?.id || 'usr_guest';
  } catch {
    return 'usr_guest';
  }
}

export const usePlaybackStore = create<PlaybackStore>((set, get) => {
  // Attach audio engine events
  globalAudioEngine.setEvents({
    onTimeUpdate: (currentTime) => {
      set({ position: currentTime });
    },
    onDurationChange: (duration) => {
      set({ duration });
    },
    onStatusChange: (status) => {
      set({ status });
    },
    onEnded: () => {
      const state = get();
      if (state.isRepeating && state.currentTrack) {
        get().seek(0, true);
        get().play(true);
      } else {
        // Paused upon finish, host will handle queue advance
        set({ status: 'paused', position: 0 });
      }
    },
  });

  return {
    currentRoomId: null,
    currentTrack: CURATED_OPEN_TRACKS[0],
    status: 'paused',
    position: 0,
    duration: CURATED_OPEN_TRACKS[0].duration,
    volume: 0.8,
    isMuted: false,
    isShuffled: false,
    isRepeating: false,
    isHost: false,
    isSoloMode: false,
    skipVotes: [],
    revision: 1,
    serverTimestamp: Date.now(),
    driftMetrics: {
      driftMs: 0,
      status: 'synced',
      latencyMs: 12,
      lastCalculated: Date.now(),
    },

    setIsHost: (isHost: boolean) => set({ isHost }),

    toggleSoloMode: () => {
      const next = !get().isSoloMode;
      set({ isSoloMode: next });
      if (!next) {
        // Leaving solo mode -> snap back to host sync immediately
        get().resyncNow();
      }
    },

    voteSkip: (userId: string, totalMembers: number, queue: QueueItem[]) => {
      const { skipVotes, currentRoomId } = get();
      if (skipVotes.includes(userId)) return;

      const nextVotes = [...skipVotes, userId];
      set({ skipVotes: nextVotes });

      const threshold = Math.max(1, Math.ceil(totalMembers / 2));
      if (currentRoomId) {
        realtimeService.broadcastEvent(
          currentRoomId,
          'SKIP_VOTE',
          { skipVotes: nextVotes, threshold },
          getCurrentUserId()
        );
      }

      if (nextVotes.length >= threshold) {
        get().nextTrack(queue);
        set({ skipVotes: [] });
      }
    },

    resetSkipVotes: () => {
      set({ skipVotes: [] });
    },

    initRoom: (roomId: string, initialTrack?: Track, isHostUser: boolean = false) => {
      const trackToPlay = initialTrack || get().currentTrack || CURATED_OPEN_TRACKS[0];
      set({
        currentRoomId: roomId,
        currentTrack: trackToPlay,
        duration: trackToPlay.duration,
        isHost: isHostUser,
        isSoloMode: false,
      });

      globalAudioEngine.loadTrack(trackToPlay.audioUrl, false);

      // Subscribe to room realtime channel
      const unsubscribe = realtimeService.subscribeToRoom(roomId, (event) => {
        get().syncFromRemoteEvent(event);
      });

      return () => {
        unsubscribe();
      };
    },

    setTrack: (track: Track, autoPlay = true, broadcast = true) => {
      set({
        currentTrack: track,
        position: 0,
        duration: track.duration,
        skipVotes: [],
        serverTimestamp: Date.now(),
        revision: get().revision + 1,
      });

      globalAudioEngine.loadTrack(track.audioUrl, autoPlay);

      if (broadcast && get().currentRoomId) {
        realtimeService.broadcastEvent(
          get().currentRoomId!,
          'TRACK_CHANGE',
          { track, position: 0 },
          getCurrentUserId()
        );
      }
    },

    play: async (broadcast = true) => {
      const { currentTrack, currentRoomId, revision } = get();
      if (!currentTrack) return;

      await globalAudioEngine.play();
      const currentPos = globalAudioEngine.getCurrentTime();
      const now = Date.now();

      set({
        status: 'playing',
        serverTimestamp: now,
        position: currentPos,
        revision: revision + 1,
      });

      if (broadcast && currentRoomId) {
        realtimeService.broadcastEvent(
          currentRoomId,
          'PLAY',
          {
            trackId: currentTrack.id,
            position: currentPos,
            serverTimestamp: now,
          },
          getCurrentUserId()
        );
      }
    },

    pause: (broadcast = true) => {
      const { currentTrack, currentRoomId, revision } = get();
      globalAudioEngine.pause();
      const currentPos = globalAudioEngine.getCurrentTime();
      const now = Date.now();

      set({
        status: 'paused',
        serverTimestamp: now,
        position: currentPos,
        revision: revision + 1,
      });

      if (broadcast && currentRoomId && currentTrack) {
        realtimeService.broadcastEvent(
          currentRoomId,
          'PAUSE',
          {
            trackId: currentTrack.id,
            position: currentPos,
            serverTimestamp: now,
          },
          getCurrentUserId()
        );
      }
    },

    togglePlay: () => {
      if (get().status === 'playing') {
        get().pause(true);
      } else {
        get().play(true);
      }
    },

    seek: (seconds: number, broadcast = true) => {
      const { currentTrack, currentRoomId, revision, status } = get();
      globalAudioEngine.seek(seconds);
      const now = Date.now();

      set({
        position: seconds,
        serverTimestamp: now,
        revision: revision + 1,
      });

      if (broadcast && currentRoomId && currentTrack) {
        realtimeService.broadcastEvent(
          currentRoomId,
          'SEEK',
          {
            trackId: currentTrack.id,
            position: seconds,
            status,
            serverTimestamp: now,
          },
          getCurrentUserId()
        );
      }
    },



    broadcastHeartbeat: () => {
      const { currentRoomId, currentTrack, status, isHost } = get();
      if (!isHost || !currentRoomId || !currentTrack) return;

      const now = Date.now();
      const currentPos = globalAudioEngine.getCurrentTime();

      realtimeService.broadcastEvent(
        currentRoomId,
        'SYNC_HEARTBEAT',
        {
          trackId: currentTrack.id,
          position: currentPos,
          status,
          serverTimestamp: now,
        },
        getCurrentUserId()
      );
    },

    resyncNow: () => {
      const state = get();
      if (state.lastHeartbeat) {
        const { trackId, position, status, serverTimestamp } = state.lastHeartbeat;

        if (state.currentTrack?.id !== trackId) {
          trackService.getTrackById(trackId).then((foundTrack) => {
            if (foundTrack) {
              state.setTrack(foundTrack, status === 'playing', false);
            }
          });
        }

        const expected = realtimeService.calculateExpectedPosition(
          position,
          serverTimestamp,
          status
        );

        globalAudioEngine.seek(expected);
        globalAudioEngine.setPlaybackRate(1.0);

        if (status === 'playing') {
          globalAudioEngine.play().catch(() => {});
        } else {
          globalAudioEngine.pause();
        }

        set({
          position: expected,
          status,
          driftMetrics: {
            driftMs: 0,
            status: 'synced',
            latencyMs: 12,
            lastCalculated: Date.now(),
          },
        });
      } else {
        globalAudioEngine.setPlaybackRate(1.0);
        if (state.status === 'playing') {
          globalAudioEngine.play().catch(() => {});
        }
        set({
          driftMetrics: {
            driftMs: 0,
            status: 'synced',
            latencyMs: 12,
            lastCalculated: Date.now(),
          },
        });
      }
    },

    nextTrack: (queue: QueueItem[]) => {
      if (!queue || queue.length === 0) return;
      const { currentTrack, isShuffled } = get();
      const currentIndex = queue.findIndex((q) => q.track.id === currentTrack?.id);

      let nextIndex = 0;
      if (isShuffled && queue.length > 1) {
        nextIndex = Math.floor(Math.random() * queue.length);
        if (nextIndex === currentIndex) nextIndex = (nextIndex + 1) % queue.length;
      } else {
        nextIndex = (currentIndex + 1) % queue.length;
      }

      const nextItem = queue[nextIndex];
      if (nextItem) {
        get().setTrack(nextItem.track, true, true);
      }
    },

    previousTrack: (queue: QueueItem[]) => {
      if (get().position > 3) {
        get().seek(0, true);
        return;
      }
      if (!queue || queue.length === 0) return;
      const { currentTrack } = get();
      const currentIndex = queue.findIndex((q) => q.track.id === currentTrack?.id);
      const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
      const prevItem = queue[prevIndex];
      if (prevItem) {
        get().setTrack(prevItem.track, true, true);
      }
    },

    setVolume: (vol: number) => {
      globalAudioEngine.setVolume(vol);
      set({ volume: vol, isMuted: vol === 0 });
    },

    toggleMute: () => {
      const { isMuted, volume } = get();
      if (isMuted) {
        globalAudioEngine.setVolume(volume || 0.8);
        set({ isMuted: false });
      } else {
        globalAudioEngine.setVolume(0);
        set({ isMuted: true });
      }
    },

    toggleShuffle: () => {
      set((s) => ({ isShuffled: !s.isShuffled }));
    },

    toggleRepeat: () => {
      set((s) => ({ isRepeating: !s.isRepeating }));
    },

    syncFromRemoteEvent: async (event: SyncEvent) => {
      const state = get();
      // Ignore own broadcasts
      if (event.senderId === getCurrentUserId()) return;
      // If listener is in Solo Mode, ignore remote sync
      if (state.isSoloMode) return;

      switch (event.type) {
        case 'SYNC_HEARTBEAT': {
          const { trackId, position, status, serverTimestamp } = event.payload;

          set({
            lastHeartbeat: { trackId, position, status, serverTimestamp },
          });

          // If track changed on host, load the new track
          if (state.currentTrack?.id !== trackId) {
            const foundTrack = await trackService.getTrackById(trackId);
            if (foundTrack) {
              state.setTrack(foundTrack, status === 'playing', false);
            }
          }

          const expected = realtimeService.calculateExpectedPosition(
            position,
            serverTimestamp,
            status
          );
          const drift = realtimeService.evaluateDrift(globalAudioEngine.getCurrentTime(), expected);

          // Apply intelligent smooth drift correction
          globalAudioEngine.applyDriftCorrection(drift.action, drift.targetPosition, drift.driftMs);

          // Sync status with host if diverged
          if (status === 'playing' && !globalAudioEngine.isPlaying()) {
            globalAudioEngine.play();
          } else if (status === 'paused' && globalAudioEngine.isPlaying()) {
            globalAudioEngine.pause();
          }

          set({
            status,
            driftMetrics: drift,
            serverTimestamp,
            revision: event.revision,
          });
          break;
        }

        case 'PLAY': {
          const { trackId, position, serverTimestamp } = event.payload;
          if (state.currentTrack?.id !== trackId) {
            const foundTrack = await trackService.getTrackById(trackId);
            if (foundTrack) {
              state.setTrack(foundTrack, false, false);
            }
          }
          const expected = realtimeService.calculateExpectedPosition(
            position,
            serverTimestamp,
            'playing'
          );
          const drift = realtimeService.evaluateDrift(globalAudioEngine.getCurrentTime(), expected);
          globalAudioEngine.applyDriftCorrection(drift.action, drift.targetPosition, drift.driftMs);
          globalAudioEngine.play();
          set({
            status: 'playing',
            position: expected,
            serverTimestamp,
            revision: event.revision,
            driftMetrics: drift,
            lastHeartbeat: { trackId, position, status: 'playing', serverTimestamp },
          });
          break;
        }

        case 'PAUSE': {
          const { trackId, position, serverTimestamp } = event.payload;
          globalAudioEngine.pause();
          globalAudioEngine.seek(position);
          set({
            status: 'paused',
            position,
            serverTimestamp,
            revision: event.revision,
            driftMetrics: {
              driftMs: 0,
              status: 'synced',
              latencyMs: 12,
              lastCalculated: Date.now(),
            },
            lastHeartbeat: { trackId: trackId || state.currentTrack?.id || '', position, status: 'paused', serverTimestamp },
          });
          break;
        }

        case 'SEEK': {
          const { position, status, serverTimestamp } = event.payload;
          const expected = realtimeService.calculateExpectedPosition(
            position,
            serverTimestamp,
            status
          );
          globalAudioEngine.seek(expected);
          if (status === 'playing') {
            globalAudioEngine.play();
          } else {
            globalAudioEngine.pause();
          }
          set({
            position: expected,
            status,
            serverTimestamp,
            revision: event.revision,
          });
          break;
        }

        case 'TRACK_CHANGE': {
          const { track, position } = event.payload;
          set({
            currentTrack: track,
            position: position || 0,
            duration: track.duration,
            skipVotes: [],
            revision: event.revision,
          });
          globalAudioEngine.loadTrack(track.audioUrl, true);
          break;
        }

        case 'SKIP_VOTE': {
          const { skipVotes: remoteVotes } = event.payload;
          set({ skipVotes: remoteVotes || [] });
          break;
        }
      }
    },
  };
});
