import { SyncEvent, SyncEventType, DriftMetrics, PlaybackStatus } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

type EventListener = (event: SyncEvent) => void;

class RealtimeService {
  private listeners: Map<string, Set<EventListener>> = new Map();
  private broadcastChannels: Map<string, BroadcastChannel> = new Map();
  private supabaseChannels: Map<string, any> = new Map();
  private revisionCounters: Map<string, number> = new Map();

  /**
   * Subscribe to room events (Playback, Chat, Reactions, Queue)
   */
  subscribeToRoom(roomId: string, listener: EventListener): () => void {
    if (!this.listeners.has(roomId)) {
      this.listeners.set(roomId, new Set());
      this.initChannel(roomId);
    }

    const roomListeners = this.listeners.get(roomId)!;
    roomListeners.add(listener);

    return () => {
      roomListeners.delete(listener);
      if (roomListeners.size === 0) {
        this.destroyChannel(roomId);
      }
    };
  }

  /**
   * Initialize local cross-tab BroadcastChannel and optional Supabase Realtime channel
   */
  private initChannel(roomId: string) {
    // 1. Cross-tab BroadcastChannel (works locally across multiple browser tabs/windows!)
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel(`modern_room_${roomId}`);
      bc.onmessage = (msgEvent) => {
        const syncEvent: SyncEvent = msgEvent.data;
        this.notifyListeners(roomId, syncEvent);
      };
      this.broadcastChannels.set(roomId, bc);
    }

    // 2. Supabase Realtime Broadcast (when configured)
    if (isSupabaseConfigured && supabase) {
      const channel = supabase.channel(`room:${roomId}`, {
        config: { broadcast: { self: false } },
      });

      channel
        .on('broadcast', { event: 'sync' }, (payload: any) => {
          this.notifyListeners(roomId, payload.payload as SyncEvent);
        })
        .subscribe();

      this.supabaseChannels.set(roomId, channel);
    }
  }

  private destroyChannel(roomId: string) {
    const bc = this.broadcastChannels.get(roomId);
    if (bc) {
      bc.close();
      this.broadcastChannels.delete(roomId);
    }

    const sc = this.supabaseChannels.get(roomId);
    if (sc && supabase) {
      supabase.removeChannel(sc);
      this.supabaseChannels.delete(roomId);
    }

    this.listeners.delete(roomId);
  }

  private notifyListeners(roomId: string, event: SyncEvent) {
    const set = this.listeners.get(roomId);
    if (set) {
      set.forEach((listener) => {
        try {
          listener(event);
        } catch (err) {
          console.error('[RealtimeService] Listener error:', err);
        }
      });
    }
  }

  /**
   * Broadcast an event to all participants
   */
  async broadcastEvent<T = any>(
    roomId: string,
    type: SyncEventType,
    payload: T,
    senderId: string
  ): Promise<SyncEvent<T>> {
    const nextRevision = (this.revisionCounters.get(roomId) || 0) + 1;
    this.revisionCounters.set(roomId, nextRevision);

    const event: SyncEvent<T> = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      roomId,
      type,
      payload,
      timestamp: Date.now(),
      senderId,
      revision: nextRevision,
    };

    // 1. Notify local listeners in same tab
    this.notifyListeners(roomId, event);

    // 2. Broadcast to other tabs via BroadcastChannel
    const bc = this.broadcastChannels.get(roomId);
    if (bc) {
      bc.postMessage(event);
    }

    // 3. Broadcast to Supabase Realtime if connected
    const sc = this.supabaseChannels.get(roomId);
    if (sc) {
      sc.send({
        type: 'broadcast',
        event: 'sync',
        payload: event,
      });
    }

    return event;
  }

  /**
   * Calculate expected playback position in seconds based on server timestamp
   */
  calculateExpectedPosition(
    authoritativePosition: number,
    serverTimestamp: number,
    status: PlaybackStatus
  ): number {
    if (status !== 'playing') {
      return authoritativePosition;
    }
    const elapsedSeconds = Math.max(0, (Date.now() - serverTimestamp) / 1000);
    return authoritativePosition + elapsedSeconds;
  }

  /**
   * Evaluate drift between local position and expected position
   */
  evaluateDrift(localCurrentTime: number, expectedCurrentTime: number): DriftMetrics & {
    action: 'none' | 'nudge' | 'seek';
    targetPosition?: number;
  } {
    const driftMs = Math.round((localCurrentTime - expectedCurrentTime) * 1000);
    const absDrift = Math.abs(driftMs);

    let status: 'synced' | 'correcting' | 'desynced' = 'synced';
    let action: 'none' | 'nudge' | 'seek' = 'none';

    if (absDrift < 120) {
      // In-sync zone: human ear cannot distinguish < 100ms
      status = 'synced';
      action = 'none';
    } else if (absDrift < 1500) {
      // Moderate drift: correct gradually or nudge
      status = 'correcting';
      action = 'nudge';
    } else {
      // Significant drift: authoritative hard seek
      status = 'desynced';
      action = 'seek';
    }

    return {
      driftMs,
      status,
      latencyMs: Math.max(8, Math.floor(Math.random() * 15)),
      lastCalculated: Date.now(),
      action,
      targetPosition: expectedCurrentTime,
    };
  }
}

export const realtimeService = new RealtimeService();
