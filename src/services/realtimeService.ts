import { SyncEvent, SyncEventType, PlaybackStatus, RoomMember } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

type EventListener = (event: SyncEvent) => void;
type PresenceListener = (members: RoomMember[]) => void;
export type PlaybackState = { trackId: string | null; status: PlaybackStatus; positionMs: number; revision: number; updatedAt: string };
type PlaybackStateListener = (state: PlaybackState) => void;

class RealtimeService {
  private listeners: Map<string, Set<EventListener>> = new Map();
  private presenceListeners: Map<string, Set<PresenceListener>> = new Map();
  private playbackListeners: Map<string, Set<PlaybackStateListener>> = new Map();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private supabaseChannels: Map<string, any[]> = new Map(); 
  private localPresenceMap: Map<string, Map<string, RoomMember>> = new Map();
  private clockOffset: number = 0;

  constructor() {
    this.syncClock();
  }

  private async syncClock() {
    if (!isSupabaseConfigured || !supabase) return;
    const t0 = Date.now();
    const { data, error } = await supabase.rpc('server_time');
    if (!error && data) {
      const t1 = Date.now();
      const rtt = t1 - t0;
      const serverTime = Number(data);
      this.clockOffset = (serverTime + rtt / 2) - t1;
    }
  }

  getServerTime() {
    return Date.now() + this.clockOffset;
  }

  subscribeToRoom(roomId: string, listener: EventListener, playbackListener?: PlaybackStateListener): () => void {
    if (!this.listeners.has(roomId)) {
      this.listeners.set(roomId, new Set());
      if (!this.presenceListeners.has(roomId)) {
          this.initChannels(roomId);
      }
    }
    this.listeners.get(roomId)!.add(listener);
    
    if (playbackListener) {
      if (!this.playbackListeners.has(roomId)) this.playbackListeners.set(roomId, new Set());
      this.playbackListeners.get(roomId)!.add(playbackListener);
    }

    return () => {
      this.listeners.get(roomId)?.delete(listener);
      if (playbackListener) this.playbackListeners.get(roomId)?.delete(playbackListener);
      this.checkCleanup(roomId);
    };
  }

  subscribeToPresence(roomId: string, listener: PresenceListener): () => void {
    if (!this.presenceListeners.has(roomId)) {
      this.presenceListeners.set(roomId, new Set());
      if (!this.listeners.has(roomId)) {
        this.initChannels(roomId);
      }
    }
    this.presenceListeners.get(roomId)!.add(listener);

    const current = this.localPresenceMap.get(roomId);
    if (current && current.size > 0) {
      listener(Array.from(current.values()));
    }

    return () => {
      this.presenceListeners.get(roomId)?.delete(listener);
      this.checkCleanup(roomId);
    };
  }

  private checkCleanup(roomId: string) {
    const l = this.listeners.get(roomId)?.size || 0;
    const p = this.presenceListeners.get(roomId)?.size || 0;
    if (l === 0 && p === 0) {
      this.destroyChannels(roomId);
    }
  }

  private initChannels(roomId: string) {
    if (!isSupabaseConfigured || !supabase) return;

    if (!this.localPresenceMap.has(roomId)) {
      this.localPresenceMap.set(roomId, new Map());
    }

    // Control Channel
    const controlChannel = supabase.channel(`room:${roomId}:control`, {
      config: {
        broadcast: { self: false, ack: true }
      }
    });

    // Social Channel (Presence)
    // Key will be generated automatically or overridden on track()
    const socialChannel = supabase.channel(`room:${roomId}:social`);

    controlChannel
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'room_playback', filter: `room_id=eq.${roomId}` }, (payload) => {
        const row = payload.new;
        const state: PlaybackState = {
          trackId: row.current_track_id,
          status: row.status as PlaybackStatus,
          positionMs: row.position_ms,
          revision: row.revision,
          updatedAt: row.updated_at
        };
        const pListeners = this.playbackListeners.get(roomId);
        if (pListeners) {
          pListeners.forEach(fn => fn(state));
        }
      })
      .on('broadcast', { event: 'sync' }, (payload: { payload: SyncEvent }) => {
        const l = this.listeners.get(roomId);
        if (l) l.forEach(fn => fn(payload.payload));
      })
      .subscribe();

    socialChannel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = socialChannel.presenceState();
        const membersList: RoomMember[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Object.values(presenceState).forEach((presences: any) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          presences.forEach((p: any) => {
            if (p && p.user) {
              membersList.push({
                id: String(p.id) || `mem_${p.user.id}`,
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
        });

        if (membersList.length > 0) {
          const map = new Map<string, RoomMember>();
          membersList.forEach(m => map.set(m.user.id, m));
          this.localPresenceMap.set(roomId, map);
          const pListeners = this.presenceListeners.get(roomId);
          if (pListeners) {
            pListeners.forEach(fn => fn(Array.from(map.values())));
          }
        }
      })
      .subscribe();

    this.supabaseChannels.set(roomId, [controlChannel, socialChannel]);
  }

  async trackPresence(roomId: string, member: RoomMember): Promise<void> {
    const sc = this.supabaseChannels.get(roomId);
    if (sc && sc[1]) {
      await sc[1].track({
        id: member.id, // we pass user id here? Actually member.user.id would be better if member.id is weird, but member.id is fine.
        user: member.user,
        role: member.role,
        status: member.status,
        statusText: member.statusText,
        activeReaction: member.activeReaction,
        joinedAt: member.joinedAt,
      });
    }
  }

  async untrackPresence(roomId: string): Promise<void> {
    const sc = this.supabaseChannels.get(roomId);
    if (sc && sc[1]) {
      await sc[1].untrack(); // Note: untrack removes all for this connection, which is what we want on leave.
    }
  }

  private destroyChannels(roomId: string) {
    const sc = this.supabaseChannels.get(roomId);
    if (sc && supabase) {
      supabase.removeChannel(sc[0]);
      supabase.removeChannel(sc[1]);
      this.supabaseChannels.delete(roomId);
    }
    this.localPresenceMap.delete(roomId);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async broadcastEvent<T = any>(roomId: string, type: SyncEventType, payload: T, senderId: string): Promise<SyncEvent<T>> {
    const event: SyncEvent<T> = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      roomId,
      type,
      payload,
      timestamp: Date.now(),
      senderId,
      revision: 0,
    };

    const sc = this.supabaseChannels.get(roomId);
    if (sc && sc[0]) {
      sc[0].send({ type: 'broadcast', event: 'sync', payload: event });
    }
    return event;
  }

  evaluateDrift(localCurrentTime: number, expectedCurrentTime: number, latencyMs: number = 0) {
    const driftMs = Math.round((localCurrentTime - expectedCurrentTime) * 1000);
    const absDrift = Math.abs(driftMs);
    let status: 'synced' | 'correcting' | 'desynced' = 'synced';
    let action: 'none' | 'nudge' | 'seek' = 'none';

    if (absDrift < 120) {
      status = 'synced'; action = 'none';
    } else if (absDrift < 1500) {
      status = 'correcting'; action = 'nudge';
    } else {
      status = 'desynced'; action = 'seek';
    }

    return {
      driftMs, status, latencyMs, lastCalculated: Date.now(), action, targetPosition: expectedCurrentTime
    };
  }
  /** Tear down all active room channels (called on sign-out) */
  leaveChannel() {
    if (!supabase) return;
    for (const roomId of this.supabaseChannels.keys()) {
      this.destroyChannels(roomId);
    }
    this.listeners.clear();
    this.presenceListeners.clear();
    this.playbackListeners.clear();
    this.localPresenceMap.clear();
  }
}

export const realtimeService = new RealtimeService();
