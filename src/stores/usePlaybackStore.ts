import { create } from 'zustand';
import { Track, PlaybackStatus, DriftMetrics, QueueItem } from '../types';
import { globalAudioEngine } from '../lib/AudioPlayer';
import { realtimeService, PlaybackState } from '../services/realtimeService';
import { CURATED_OPEN_TRACKS } from '../services/openMusicService';
import { trackService } from '../services/trackService';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

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
  isSoloMode: boolean; 
  revision: number;
  serverTimestamp: number;
  driftMetrics: DriftMetrics;

  skipVotes: string[];

  // Actions
  setIsHost: (isHost: boolean) => void;
  toggleSoloMode: () => void;
  voteSkip: (userId: string, totalMembers: number, queue: QueueItem[]) => void;
  resetSkipVotes: () => void;
  initRoom: (roomId: string, initialTrack?: Track, isHostUser?: boolean) => () => void;
  setTrack: (track: Track, autoPlay?: boolean) => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  resyncNow: () => void;
  nextTrack: (queue: QueueItem[]) => void;
  previousTrack: (queue: QueueItem[]) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  syncFromPlaybackState: (state: PlaybackState) => Promise<void>;
  resetPlaybackState: () => void;
}

export const usePlaybackStore = create<PlaybackStore>((set, get) => {
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
        if (state.isHost) {
          get().seek(0);
          get().play();
        } else {
          set({ status: 'paused', position: 0 });
        }
      } else {
        set({ status: 'paused', position: 0 });
        if (state.isHost && state.currentRoomId) {
          if (isSupabaseConfigured && supabase) {
             supabase.rpc('advance_room_track', { p_room_id: state.currentRoomId, p_expected_revision: state.revision }).then();
          }
        }
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
    revision: 0,
    serverTimestamp: Date.now(),
    driftMetrics: {
      driftMs: 0,
      status: 'synced',
      latencyMs: 12,
      lastCalculated: Date.now(),
    },

    resetPlaybackState: () => {
      set({
        currentRoomId: null,
        currentTrack: null,
        status: 'idle',
        position: 0,
        duration: 0,
        isHost: false,
        isSoloMode: false,
        revision: 0,
        serverTimestamp: 0,
        skipVotes: [],
      });
      globalAudioEngine.pause();
    },

    setIsHost: (isHost: boolean) => set({ isHost }),

    toggleSoloMode: () => {
      const next = !get().isSoloMode;
      set({ isSoloMode: next });
      if (!next) {
        get().resyncNow();
      }
    },

    voteSkip: async (userId: string, _totalMembers: number, _queue: QueueItem[]) => {
      const { skipVotes, currentRoomId } = get();
      if (skipVotes.includes(userId)) return;

      const nextVotes = [...skipVotes, userId];
      set({ skipVotes: nextVotes });

      if (currentRoomId && isSupabaseConfigured && supabase) {
         const { data, error } = await supabase.rpc('vote_skip', {
            p_room_id: currentRoomId,
            p_expected_revision: get().revision,
         });
         if (!error && data && data.advanced) {
            set({ skipVotes: [] });
         } else if (data && data.stale) {
            // State is stale, they'll get an update via realtime
         } else if (error) {
            console.error('Vote skip error:', error);
         }
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
        revision: 0,
      });

      globalAudioEngine.loadTrack(trackToPlay.audioUrl, false);

      const unsubscribe = realtimeService.subscribeToRoom(roomId, (_event) => {
         // handle chat/reaction? No, that's done in components
      }, (state) => {
         get().syncFromPlaybackState(state);
      });

      return () => {
        unsubscribe();
      };
    },

    setTrack: async (track: Track, autoPlay = true) => {
      set({
        currentTrack: track,
        position: 0,
        duration: track.duration,
        skipVotes: [],
      });
      await globalAudioEngine.loadTrack(track.audioUrl, autoPlay);
    },

    play: async () => {
      const { currentTrack, currentRoomId, revision } = get();
      if (!currentTrack) return;

      await globalAudioEngine.play();
      const currentPos = globalAudioEngine.getCurrentTime();
      
      set({ status: 'playing', position: currentPos });

      if (get().isHost && currentRoomId && isSupabaseConfigured && supabase) {
        supabase.rpc('set_playback_state', {
          p_room_id: currentRoomId,
          p_status: 'playing',
          p_position_ms: Math.floor(currentPos * 1000),
          p_expected_revision: revision
        });
      }
    },

    pause: () => {
      const { currentTrack, currentRoomId, revision } = get();
      globalAudioEngine.pause();
      const currentPos = globalAudioEngine.getCurrentTime();

      set({ status: 'paused', position: currentPos });

      if (get().isHost && currentRoomId && currentTrack && isSupabaseConfigured && supabase) {
        supabase.rpc('set_playback_state', {
          p_room_id: currentRoomId,
          p_status: 'paused',
          p_position_ms: Math.floor(currentPos * 1000),
          p_expected_revision: revision
        });
      }
    },

    togglePlay: () => {
      if (get().status === 'playing') {
        get().pause();
      } else {
        get().play();
      }
    },

    seek: (seconds: number) => {
      const { currentTrack, currentRoomId, revision, status } = get();
      globalAudioEngine.seek(seconds);

      set({ position: seconds });

      if (get().isHost && currentRoomId && currentTrack && isSupabaseConfigured && supabase) {
        supabase.rpc('set_playback_state', {
          p_room_id: currentRoomId,
          p_status: status,
          p_position_ms: Math.floor(seconds * 1000),
          p_expected_revision: revision
        });
      }
    },

    resyncNow: () => {
      const state = get();
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
    },

    nextTrack: (queue: QueueItem[]) => {
      const { currentRoomId, revision } = get();
      if (!queue || queue.length === 0 || !currentRoomId) return;
      
      if (isSupabaseConfigured && supabase) {
         supabase.rpc('advance_room_track', { p_room_id: currentRoomId, p_expected_revision: revision });
      }
    },

    previousTrack: (_queue: QueueItem[]) => {
      // Per instructions: previousTrack = restart current track
      get().seek(0);
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

    syncFromPlaybackState: async (remoteState: PlaybackState) => {
      const state = get();
      if (state.isSoloMode) return;
      if (remoteState.revision <= state.revision) return;
      
      set({ revision: remoteState.revision });

      const serverTimestamp = new Date(remoteState.updatedAt).getTime();
      const authoritativePosition = remoteState.positionMs / 1000;
      
      let expectedPosition = authoritativePosition;
      let latencyMs = 0;
      if (remoteState.status === 'playing') {
          const elapsedMs = Math.max(0, realtimeService.getServerTime() - serverTimestamp);
          latencyMs = Math.max(10, Math.min(500, elapsedMs / 2));
          expectedPosition = authoritativePosition + (elapsedMs / 1000);
      }

      if (state.currentTrack?.id !== remoteState.trackId) {
         if (remoteState.trackId) {
            const foundTrack = await trackService.getTrackById(remoteState.trackId);
            if (foundTrack) {
               await state.setTrack(foundTrack, false);
            }
         } else {
            set({ currentTrack: null });
         }
      }

      const drift = realtimeService.evaluateDrift(globalAudioEngine.getCurrentTime(), expectedPosition, latencyMs);
      
      if (remoteState.status === 'playing') {
          globalAudioEngine.applyDriftCorrection(drift.action, drift.targetPosition, drift.driftMs);
          if (!globalAudioEngine.isPlaying()) {
              globalAudioEngine.play();
          }
      } else {
          globalAudioEngine.pause();
          globalAudioEngine.seek(expectedPosition);
      }

      set({
         status: remoteState.status,
         position: expectedPosition,
         serverTimestamp,
         driftMetrics: drift,
      });
    }
  };
});
