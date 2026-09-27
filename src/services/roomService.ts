import { Room, RoomMember, QueueItem, User, Track } from '../types';
import { DEMO_ROOMS, DEMO_MEMBERS, DEMO_QUEUE, DEMO_USERS, DEMO_TRACKS } from '../data/mockData';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

// In-memory demo store
let roomsStore: Room[] = [...DEMO_ROOMS];
const membersStore: Record<string, RoomMember[]> = { ...DEMO_MEMBERS };
const queueStore: Record<string, QueueItem[]> = { ...DEMO_QUEUE };

export const roomService = {
  async getLiveRooms(): Promise<Room[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('rooms')
        .select('*, host:profiles(*), current_track:tracks(*)')
        .eq('is_live', true)
        .order('listener_count', { ascending: false });

      if (!error && data) {
        return data.map((r: any) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          artwork: r.artwork,
          host: {
            id: r.host.id,
            username: r.host.username,
            name: r.host.name,
            avatar: r.host.avatar,
          },
          isLive: r.is_live,
          listenerCount: r.listener_count,
          currentTrackId: r.current_track_id,
          currentTrack: r.current_track,
          settings: r.settings || {
            allowChat: true,
            allowQueueAdditions: true,
            playbackPermissions: 'everyone',
            visibility: 'public',
            maxListeners: 100,
            bitrateKbps: 320,
          },
          createdAt: r.created_at,
          tags: r.tags || [],
        }));
      }
    }
    // Demo implementation
    return [...roomsStore];
  },

  async getRoomById(id: string): Promise<Room | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('rooms')
        .select('*, host:profiles(*), current_track:tracks(*)')
        .eq('id', id)
        .single();

      if (!error && data) {
        return {
          id: data.id,
          name: data.name,
          description: data.description,
          artwork: data.artwork,
          host: {
            id: data.host.id,
            username: data.host.username,
            name: data.host.name,
            avatar: data.host.avatar,
          },
          isLive: data.is_live,
          listenerCount: data.listener_count,
          currentTrackId: data.current_track_id,
          currentTrack: data.current_track,
          settings: data.settings,
          createdAt: data.created_at,
          tags: data.tags || [],
        };
      }
    }

    const room = roomsStore.find((r) => r.id.toLowerCase() === id.toLowerCase());
    return room || null;
  },

  async createRoom(data: {
    name: string;
    description?: string;
    artwork?: string;
    visibility: 'public' | 'unlisted' | 'private';
    playbackPermissions: 'host_only' | 'everyone' | 'voting';
    allowChat?: boolean;
    allowQueueAdditions?: boolean;
    maxListeners?: number;
    host?: User;
  }): Promise<Room> {
    const slug = data.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `room-${Date.now().toString(36)}`;

    const newRoom: Room = {
      id: slug,
      name: data.name,
      description: data.description || 'A private space for listening with friends.',
      artwork:
        data.artwork ||
        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
      host: data.host || DEMO_USERS.alex,
      isLive: true,
      listenerCount: 1,
      currentTrackId: DEMO_TRACKS[0].id,
      currentTrack: DEMO_TRACKS[0],
      settings: {
        allowChat: data.allowChat ?? true,
        allowQueueAdditions: data.allowQueueAdditions ?? true,
        playbackPermissions: data.playbackPermissions,
        visibility: data.visibility,
        maxListeners: data.maxListeners || 50,
        bitrateKbps: 320,
      },
      createdAt: new Date().toISOString(),
      tags: ['New', 'Community'],
    };

    if (isSupabaseConfigured && supabase) {
      await supabase.from('rooms').insert({
        id: newRoom.id,
        name: newRoom.name,
        description: newRoom.description,
        artwork: newRoom.artwork,
        host_id: newRoom.host.id,
        is_live: true,
        listener_count: 1,
        settings: newRoom.settings,
      });
    }

    // Add to demo store
    roomsStore = [newRoom, ...roomsStore];
    membersStore[newRoom.id] = [
      {
        id: `mem_${Date.now()}`,
        roomId: newRoom.id,
        user: DEMO_USERS.alex,
        role: 'host',
        status: 'host',
        statusText: 'Host',
        joinedAt: new Date().toISOString(),
        isSynced: true,
        driftMs: 0,
      },
    ];
    queueStore[newRoom.id] = [
      {
        id: `q_${Date.now()}`,
        roomId: newRoom.id,
        track: DEMO_TRACKS[0],
        addedBy: DEMO_USERS.alex,
        addedAt: new Date().toISOString(),
        votes: 1,
        hasVoted: true,
      },
      {
        id: `q_${Date.now() + 1}`,
        roomId: newRoom.id,
        track: DEMO_TRACKS[1],
        addedBy: DEMO_USERS.alex,
        addedAt: new Date().toISOString(),
        votes: 0,
        hasVoted: false,
      },
    ];

    return newRoom;
  },

  async updateRoom(
    roomId: string,
    updates: {
      name?: string;
      description?: string;
      artwork?: string;
      settings?: any;
    }
  ): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const payload: Record<string, any> = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.description !== undefined) payload.description = updates.description;
      if (updates.artwork !== undefined) payload.artwork = updates.artwork;
      if (updates.settings !== undefined) payload.settings = updates.settings;

      await supabase.from('rooms').update(payload).eq('id', roomId);
    }

    roomsStore = roomsStore.map((r) =>
      r.id === roomId
        ? {
            ...r,
            ...(updates.name ? { name: updates.name } : {}),
            ...(updates.description !== undefined ? { description: updates.description } : {}),
            ...(updates.artwork ? { artwork: updates.artwork } : {}),
            ...(updates.settings ? { settings: updates.settings } : {}),
          }
        : r
    );
  },

  async getRoomMembers(roomId: string): Promise<RoomMember[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('room_members')
        .select('*, user:profiles(*)')
        .eq('room_id', roomId);
      if (!error && data) {
        return data.map((m: any) => ({
          id: m.id,
          roomId: m.room_id,
          user: m.user,
          role: m.role,
          status: m.status,
          statusText: m.status_text,
          activeReaction: m.active_reaction,
          joinedAt: m.joined_at,
          isSynced: true,
          driftMs: 0,
        }));
      }
    }

    return membersStore[roomId] || [
      {
        id: `mem_host`,
        roomId,
        user: DEMO_USERS.alex,
        role: 'host',
        status: 'host',
        statusText: 'Host',
        joinedAt: new Date().toISOString(),
        isSynced: true,
        driftMs: 0,
      },
    ];
  },

  async joinRoom(roomId: string, user: User): Promise<RoomMember> {
    const existing = membersStore[roomId]?.find((m) => m.user.id === user.id);
    if (existing) return existing;

    const newMember: RoomMember = {
      id: `mem_${Date.now()}`,
      roomId,
      user,
      role: 'listener',
      status: 'joined',
      statusText: 'Just Joined',
      speechBubble: {
        text: 'just joined the room! 👋',
        expiresAt: Date.now() + 30000,
      },
      joinedAt: new Date().toISOString(),
      isSynced: true,
      driftMs: Math.floor(Math.random() * 20) - 10,
    };

    if (isSupabaseConfigured && supabase) {
      await supabase.from('room_members').upsert({
        id: newMember.id,
        room_id: roomId,
        user_id: user.id,
        role: newMember.role,
        status: newMember.status,
        status_text: newMember.statusText,
        drift_ms: newMember.driftMs,
      });
    }

    if (!membersStore[roomId]) {
      membersStore[roomId] = [];
    }
    membersStore[roomId] = [newMember, ...membersStore[roomId]];

    // Increment room listener count
    const r = roomsStore.find((room) => room.id === roomId);
    if (r) {
      r.listenerCount += 1;
    }

    return newMember;
  },

  async getRoomQueue(roomId: string): Promise<QueueItem[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('queue_items')
        .select('*, track:tracks(*), added_by:profiles(*)')
        .eq('room_id', roomId)
        .order('votes', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((q: any) => ({
          id: q.id,
          roomId: q.room_id,
          track: q.track,
          addedBy: q.added_by,
          addedAt: q.added_at,
          votes: q.votes,
          hasVoted: false,
        }));
      }
    }

    return queueStore[roomId] || [];
  },

  async addQueueTrack(roomId: string, track: Track, user: User): Promise<QueueItem> {
    const newItem: QueueItem = {
      id: `q_${Date.now()}`,
      roomId,
      track,
      addedBy: user,
      addedAt: new Date().toISOString(),
      votes: 1,
      hasVoted: true,
    };

    if (isSupabaseConfigured && supabase) {
      await supabase.from('queue_items').insert({
        id: newItem.id,
        room_id: roomId,
        track_id: track.id,
        added_by_id: user.id,
        votes: 1,
      });
    }

    if (!queueStore[roomId]) {
      queueStore[roomId] = [];
    }
    queueStore[roomId] = [...queueStore[roomId], newItem];
    return newItem;
  },

  async voteQueueItem(roomId: string, queueItemId: string): Promise<QueueItem | null> {
    const list = queueStore[roomId];
    if (!list) return null;
    const item = list.find((i) => i.id === queueItemId);
    if (!item) return null;

    if (item.hasVoted) {
      item.votes = Math.max(0, item.votes - 1);
      item.hasVoted = false;
    } else {
      item.votes += 1;
      item.hasVoted = true;
    }

    if (isSupabaseConfigured && supabase) {
      await supabase
        .from('queue_items')
        .update({ votes: item.votes })
        .eq('id', queueItemId);
    }

    // Sort queue by votes descending, keeping first (currently playing) if applicable
    const [current, ...rest] = list;
    rest.sort((a, b) => b.votes - a.votes);
    queueStore[roomId] = [current, ...rest];

    return item;
  },

  async removeQueueItem(roomId: string, queueItemId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      await supabase.from('queue_items').delete().eq('id', queueItemId);
    }
    if (!queueStore[roomId]) return;
    queueStore[roomId] = queueStore[roomId].filter((item) => item.id !== queueItemId);
  },
};
