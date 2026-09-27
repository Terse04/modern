import { SyncEvent, SyncEventType, DriftMetrics, PlaybackStatus, RoomMember } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

type EventListener = (event: SyncEvent) => void;
type PresenceListener = (members: RoomMember[]) => void;

class RealtimeService {
  private listeners: Map<string, Set<EventListener>> = new Map();
  private presenceListeners: Map<string, Set<PresenceListener>> = new Map();
  private broadcastChannels: Map<string, BroadcastChannel> = new Map();
  private supabaseChannels: Map<string, any> = new Map();
  private revisionCounters: Map<string, number> = new Map();
  private localPresenceMap: Map<string, Map<string, RoomMember>> = new Map();

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
      if (roomListeners.size === 0 && (!this.presenceListeners.get(roomId) || this.presenceListeners.get(roomId)!.size === 0)) {
        this.destroyChannel(roomId);
      }
    };
  }

  /**
   * Subscribe to live presence changes (active participants)
   */
  subscribeToPresence(roomId: string, listener: PresenceListener): () => void {
    if (!this.presenceListeners.has(roomId)) {
      this.presenceListeners.set(roomId, new Set());
      if (!this.listeners.has(roomId)) {
        this.initChannel(roomId);
      }
    }

    const roomPresListeners = this.presenceListeners.get(roomId)!;
    roomPresListeners.add(listener);

    // Initial dispatch of currently known local members
    const current = this.localPresenceMap.get(roomId);
    if (current && current.size > 0) {
      listener(Array.from(current.values()));
    }

    return () => {
      roomPresListeners.delete(listener);
      if (roomPresListeners.size === 0 && (!this.listeners.get(roomId) || this.listeners.get(roomId)!.size === 0)) {
        this.destroyChannel(roomId);
      }
    };
  }

  /**
   * Initialize local cross-tab BroadcastChannel and optional Supabase Realtime channel
   */
  private initChannel(roomId: string) {
    if (!this.localPresenceMap.has(roomId)) {
      this.localPresenceMap.set(roomId, new Map());
    }

    // 1. Cross-tab BroadcastChannel (works locally across multiple browser tabs/windows!)
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel(`modern_room_${roomId}`);
      bc.onmessage = (msgEvent) => {
        const data = msgEvent.data;
        if (data && data.__type === 'PRESENCE_SYNC_BC') {
          const { action, member } = data;
          const roomPresences = this.localPresenceMap.get(roomId) || new Map();
          if (action === 'leave') {
            roomPresences.delete(member.user.id);
          } else {
            roomPresences.set(member.user.id, member);
          }
          this.localPresenceMap.set(roomId, roomPresences);
          this.notifyPresenceListeners(roomId, Array.from(roomPresences.values()));
          return;
        }

        const syncEvent: SyncEvent = data;
        this.notifyListeners(roomId, syncEvent);
      };
      this.broadcastChannels.set(roomId, bc);
    }

    // 2. Supabase Realtime Broadcast & Presence (when configured)
    if (isSupabaseConfigured && supabase) {
      const channel = supabase.channel(`room:${roomId}`, {
        config: {
          broadcast: { self: false },
        },
      });

      channel
        .on('broadcast', { event: 'sync' }, (payload: any) => {
          this.notifyListeners(roomId, payload.payload as SyncEvent);
        })
        .on('presence', { event: 'sync' }, () => {
          const presenceState = channel.presenceState();
          const membersList: RoomMember[] = [];
          Object.values(presenceState).forEach((presences: any) => {
            if (Array.isArray(presences)) {
              presences.forEach((p: any) => {
                if (p && p.user) {
                  membersList.push({
                    id: p.id || `mem_${p.user.id}`,
                    roomId,
                    user: p.user,
                    role: p.role || 'listener',
                    status: p.status || 'listening',
                    statusText: p.statusText || 'Listening',
                    activeReaction: p.activeReaction,
                    joinedAt: p.joinedAt || new Date().toISOString(),
                    isSynced: true,
                    driftMs: 0,
                  });
                }
              });
            }
          });

          if (membersList.length > 0) {
            const map = new Map<string, RoomMember>();
            membersList.forEach((m) => map.set(m.user.id, m));
            this.localPresenceMap.set(roomId, map);
            this.notifyPresenceListeners(roomId, Array.from(map.values()));
          }
        })
        .subscribe();

      this.supabaseChannels.set(roomId, channel);
    }
  }

  /**
   * Track current user presence in the room
   */
  async trackPresence(roomId: string, member: RoomMember): Promise<void> {
    // 1. Update local presence map
    const map = this.localPresenceMap.get(roomId) || new Map();
    map.set(member.user.id, member);
    this.localPresenceMap.set(roomId, map);
    this.notifyPresenceListeners(roomId, Array.from(map.values()));

    // 2. Cross-tab broadcast
    const bc = this.broadcastChannels.get(roomId);
    if (bc) {
      bc.postMessage({
        __type: 'PRESENCE_SYNC_BC',
        action: 'join',
        member,
      });
    }

    // 3. Supabase presence tracking
    const sc = this.supabaseChannels.get(roomId);
    if (sc) {
      await sc.track({
        id: member.id,
        user: member.user,
        role: member.role,
        status: member.status,
        statusText: member.statusText,
        activeReaction: member.activeReaction,
        joinedAt: member.joinedAt,
      });
    }
  }

  /**
   * Untrack current user when leaving the room
   */
  async untrackPresence(roomId: string, userId: string): Promise<void> {
    const map = this.localPresenceMap.get(roomId);
    if (map) {
      const member = map.get(userId);
      map.delete(userId);
      this.notifyPresenceListeners(roomId, Array.from(map.values()));

      const bc = this.broadcastChannels.get(roomId);
      if (bc && member) {
        bc.postMessage({
          __type: 'PRESENCE_SYNC_BC',
          action: 'leave',
          member,
        });
      }
    }

    const sc = this.supabaseChannels.get(roomId);
    if (sc) {
      await sc.untrack();
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
    this.presenceListeners.delete(roomId);
    this.localPresenceMap.delete(roomId);
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

  private notifyPresenceListeners(roomId: string, members: RoomMember[]) {
    const set = this.presenceListeners.get(roomId);
    if (set) {
      set.forEach((listener) => {
        try {
          listener(members);
        } catch (err) {
          console.error('[RealtimeService] Presence error:', err);
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
      status = 'synced';
      action = 'none';
    } else if (absDrift < 1500) {
      status = 'correcting';
      action = 'nudge';
    } else {
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
