import { useEffect, useRef, useCallback } from 'react';
import { ChatMessage, FloatingReaction, QueueItem, RoomMember, SyncEvent, RoomSettings } from '../types';
import { realtimeService } from '../services/realtimeService';
import { useAuthStore } from '../stores/useAuthStore';
import { roomService } from '../services/roomService';

export interface RealtimeRoomHandlers {
  onChatMessage: (msg: ChatMessage) => void;
  onFloatingReaction: (reaction: FloatingReaction) => void;
  onQueueUpdate: (queue: QueueItem[]) => void;
  onMemberUpdate: (member: RoomMember) => void;
  onMemberLeft: (userId: string) => void;
  onPresenceSync?: (members: RoomMember[]) => void;
  onRoomSettingsUpdate?: (settings: RoomSettings) => void;
}

/**
 * Subscribes to all realtime events & Supabase Presence for a room and dispatches them
 * to the appropriate handlers. Returns helpers to broadcast chat messages, reactions, and queue updates.
 */
export function useRealtimeRoom(
  roomId: string | undefined,
  handlers: RealtimeRoomHandlers
) {
  const currentUser = useAuthStore((s) => s.currentUser);

  // Keep handlers stable across re-renders without breaking the subscription
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const userRef = useRef(currentUser);
  useEffect(() => {
    userRef.current = currentUser;
  }, [currentUser]);

  // 1. Room message & broadcast subscriptions
  useEffect(() => {
    if (!roomId) return;

    const unsubscribe = realtimeService.subscribeToRoom(roomId, (event: SyncEvent) => {
      // Ignore own events (already handled optimistically)
      if (event.senderId === userRef.current.id) return;

      switch (event.type) {
        case 'CHAT_MESSAGE': {
          const msg = event.payload as ChatMessage;
          handlersRef.current.onChatMessage(msg);
          break;
        }

        case 'REACTION': {
          const reaction = event.payload as FloatingReaction;
          handlersRef.current.onFloatingReaction(reaction);
          break;
        }

        case 'QUEUE_UPDATE': {
          const { queue } = event.payload as { queue: QueueItem[] };
          handlersRef.current.onQueueUpdate(queue);
          break;
        }

        case 'PRESENCE_SYNC': {
          const { action, member } = event.payload as {
            action: 'join' | 'leave' | 'update';
            member: RoomMember;
          };
          if (action === 'leave') {
            handlersRef.current.onMemberLeft(member.user.id);
          } else {
            handlersRef.current.onMemberUpdate(member);
          }
          break;
        }

        case 'ROOM_SETTINGS_UPDATE': {
          const { settings } = event.payload as { settings: RoomSettings };
          if (settings) {
            handlersRef.current.onRoomSettingsUpdate?.(settings);
          }
          break;
        }

        default:
          break;
      }
    });

    return unsubscribe;
  }, [roomId]);

  // 2. Live Supabase Presence subscription
  useEffect(() => {
    if (!roomId) return;

    const unsubscribePresence = realtimeService.subscribeToPresence(roomId, (members) => {
      handlersRef.current.onPresenceSync?.(members);
    });

    // Handle tab closing or backgrounding
    const handleLeave = () => {
      realtimeService.untrackPresence(roomId);
      void roomService.leaveRoom(roomId);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // We do NOT fully leave on hidden, we just mark inactive in a real app,
        // but iOS safari needs pagehide.
      }
    };

    window.addEventListener('beforeunload', handleLeave);
    window.addEventListener('pagehide', handleLeave);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Call room_heartbeat every 30 seconds to maintain DB membership
    const heartbeatInterval = setInterval(() => {
      // We assume roomService.heartbeat(roomId) will be added if needed, or we just call the RPC
      // Wait, we need to add room_heartbeat RPC! 
      // The instruction says: "Call room_heartbeat (BUG-05) on an interval for DB-backed membership"
      roomService.heartbeat(roomId).catch(() => {});
    }, 30000);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('beforeunload', handleLeave);
      window.removeEventListener('pagehide', handleLeave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unsubscribePresence();
      handleLeave();
    };
  }, [roomId]);

  // ─── Broadcast helpers ────────────────────────────────────────────────────

  const broadcastChat = useCallback(
    async (msg: ChatMessage) => {
      if (!roomId) return;
      await realtimeService.broadcastEvent(roomId, 'CHAT_MESSAGE', msg, userRef.current.id);
    },
    [roomId]
  );

  const broadcastReaction = useCallback(
    async (reaction: FloatingReaction) => {
      if (!roomId) return;
      await realtimeService.broadcastEvent(roomId, 'REACTION', reaction, userRef.current.id);
    },
    [roomId]
  );

  const broadcastQueueUpdate = useCallback(
    async (queue: QueueItem[]) => {
      if (!roomId) return;
      await realtimeService.broadcastEvent(roomId, 'QUEUE_UPDATE', { queue }, userRef.current.id);
    },
    [roomId]
  );

  const broadcastPresence = useCallback(
    async (action: 'join' | 'leave' | 'update', member: RoomMember) => {
      if (!roomId) return;
      await realtimeService.broadcastEvent(
        roomId,
        'PRESENCE_SYNC',
        { action, member },
        userRef.current.id
      );
    },
    [roomId]
  );

  /**
   * Called when the current user joins. Tracks presence in Supabase Realtime
   * and dispatches join event.
   */
  const joinAsCurrentUser = useCallback(async () => {
    if (!roomId) return;
    const member = await roomService.joinRoom(roomId, userRef.current);
    await realtimeService.trackPresence(roomId, member);
    await broadcastPresence('join', member);
    return member;
  }, [roomId, broadcastPresence]);

  const broadcastRoomSettings = useCallback(
    async (settings: RoomSettings) => {
      if (!roomId) return;
      await realtimeService.broadcastEvent(
        roomId,
        'ROOM_SETTINGS_UPDATE',
        { settings },
        userRef.current.id
      );
    },
    [roomId]
  );

  return {
    currentUser,
    broadcastChat,
    broadcastReaction,
    broadcastQueueUpdate,
    broadcastPresence,
    broadcastRoomSettings,
    joinAsCurrentUser,
  };
}
