import { create } from 'zustand';
import { Track, PlaybackStatus, DriftMetrics, SyncEvent, QueueItem } from '../types';
import { globalAudioEngine } from '../lib/AudioPlayer';
import { realtimeService } from '../services/realtimeService';
import { DEMO_TRACKS, CURRENT_USER } from '../data/mockData';

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
  revision: number;
  serverTimestamp: number;
  driftMetrics: DriftMetrics;

  // Actions
  initRoom: (roomId: string, initialTrack?: Track) => () => void;
  setTrack: (track: Track, autoPlay?: boolean, broadcast?: boolean) => void;
  play: (broadcast?: boolean) => Promise<void>;
  pause: (broadcast?: boolean) => void;
  togglePlay: () => void;
  seek: (seconds: number, broadcast?: boolean) => void;
  nextTrack: (queue: QueueItem[]) => void;
  previousTrack: (queue: QueueItem[]) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  syncFromRemoteEvent: (event: SyncEvent) => void;
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
        // Trigger auto advance if next track exists
        set({ status: 'paused', position: 0 });
      }
    },
  });

  return {
    currentRoomId: null,
    currentTrack: DEMO_TRACKS[0],
    status: 'paused',
    position: 0,
    duration: DEMO_TRACKS[0].duration,
    volume: 0.8,
    isMuted: false,
    isShuffled: false,
    isRepeating: false,
    revision: 1,
    serverTimestamp: Date.now(),
    driftMetrics: {
      driftMs: 0,
      status: 'synced',
      latencyMs: 12,
      lastCalculated: Date.now(),
    },

    initRoom: (roomId: string, initialTrack?: Track) => {
      const trackToPlay = initialTrack || get().currentTrack || DEMO_TRACKS[0];
      set({
        currentRoomId: roomId,
        currentTrack: trackToPlay,
        duration: trackToPlay.duration,
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
        serverTimestamp: Date.now(),
        revision: get().revision + 1,
      });

      globalAudioEngine.loadTrack(track.audioUrl, autoPlay);

      if (broadcast && get().currentRoomId) {
        realtimeService.broadcastEvent(
          get().currentRoomId!,
          'TRACK_CHANGE',
          { track, position: 0 },
          CURRENT_USER.id
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
          CURRENT_USER.id
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
          CURRENT_USER.id
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
          CURRENT_USER.id
        );
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

    syncFromRemoteEvent: (event: SyncEvent) => {
      const state = get();
      // Ignore own broadcasts
      if (event.senderId === CURRENT_USER.id) return;

      switch (event.type) {
        case 'PLAY': {
          const { trackId, position, serverTimestamp } = event.payload;
          if (state.currentTrack?.id !== trackId) {
            const foundTrack = DEMO_TRACKS.find((t) => t.id === trackId);
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
          });
          break;
        }

        case 'PAUSE': {
          const { position, serverTimestamp } = event.payload;
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
            revision: event.revision,
          });
          globalAudioEngine.loadTrack(track.audioUrl, true);
          break;
        }
      }
    },
  };
});
