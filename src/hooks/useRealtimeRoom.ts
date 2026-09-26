import { useEffect, useRef, useCallback } from 'react';
import { ChatMessage, FloatingReaction, QueueItem, RoomMember, SyncEvent } from '../types';
import { realtimeService } from '../services/realtimeService';
import { useAuthStore } from '../stores/useAuthStore';
import { roomService } from '../services/roomService';

export interface RealtimeRoomHandlers {
  onChatMessage: (msg: ChatMessage) => void;
  onFloatingReaction: (reaction: FloatingReaction) => void;
  onQueueUpdate: (queue: QueueItem[]) => void;
  onMemberUpdate: (member: RoomMember) => void;
  onMemberLeft: (userId: string) => void;
}

/**
 * Subscribes to all realtime events for a room and dispatches them to the
 * appropriate handlers. Returns helpers to broadcast chat messages and reactions.
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

        // Playback events (PLAY, PAUSE, SEEK, TRACK_CHANGE) are handled
        // by usePlaybackStore which has its own subscription via initRoom().
        default:
          break;
      }
    });

    return unsubscribe;
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
   * Called when the current user joins. Broadcasts presence and triggers
   * a join via roomService (which may update member lists).
   */
  const joinAsCurrentUser = useCallback(async () => {
    if (!roomId) return;
    const member = await roomService.joinRoom(roomId, userRef.current);
    await broadcastPresence('join', member);
    return member;
  }, [roomId, broadcastPresence]);

  return {
    currentUser,
    broadcastChat,
    broadcastReaction,
    broadcastQueueUpdate,
    broadcastPresence,
    joinAsCurrentUser,
  };
}
