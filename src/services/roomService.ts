import { Room, RoomMember, QueueItem, User, Track } from '../types';
import { CURATED_OPEN_TRACKS } from './openMusicService';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const DEFAULT_HOST_FALLBACK: User = {
  id: 'usr_host',
  username: 'host',
  name: 'Room Host',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80',
};

// In-memory store (real user rooms cached locally)
let roomsStore: Room[] = [];
const membersStore: Record<string, RoomMember[]> = {};
const queueStore: Record<string, QueueItem[]> = {};

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
          host: r.host
            ? {
                id: r.host.id,
                username: r.host.username,
                name: r.host.name,
                avatar: r.host.avatar,
              }
            : DEFAULT_HOST_FALLBACK,
          isLive: r.is_live,
          listenerCount: r.listener_count || 1,
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
    const cleanId = id.trim().toLowerCase().replace(/^#+/, '');
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('rooms')
        .select('*, host:profiles(*), current_track:tracks(*)')
        .ilike('id', cleanId)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          name: data.name,
          description: data.description,
          artwork: data.artwork,
          host: data.host
            ? {
                id: data.host.id,
                username: data.host.username,
                name: data.host.name,
                avatar: data.host.avatar,
              }
            : DEFAULT_HOST_FALLBACK,
          isLive: data.is_live,
          listenerCount: data.listener_count || 1,
          currentTrackId: data.current_track_id,
          currentTrack: data.current_track,
          settings: data.settings || {
            allowChat: true,
            allowQueueAdditions: true,
            playbackPermissions: 'everyone',
            visibility: 'public',
            maxListeners: 100,
            bitrateKbps: 320,
          },
          createdAt: data.created_at,
          tags: data.tags || [],
        };
      }
    }

    const room = roomsStore.find(
      (r) => r.id.toLowerCase() === cleanId || r.id.toLowerCase() === id.toLowerCase()
    );
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
      .replace(/^#+/, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `room-${Date.now().toString(36)}`;

    const hostUser = data.host || DEFAULT_HOST_FALLBACK;
    const isUuid = (val?: string) =>
      Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
    const dbHostId = isUuid(hostUser?.id) ? hostUser.id : null;

    const initialTrack = CURATED_OPEN_TRACKS[0];
    const newRoom: Room = {
      id: slug,
      name: data.name,
      description: data.description || 'A private space for listening with friends.',
      artwork:
        data.artwork ||
        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
      host: hostUser,
      isLive: true,
      listenerCount: 1,
      currentTrackId: initialTrack.id,
      currentTrack: initialTrack,
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
      // Ensure the initial track exists in the DB so the FK works
      try {
        await fetch('/api/admin?action=upsert-track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: initialTrack.id,
            title: initialTrack.title,
            artist: initialTrack.artist,
            album: initialTrack.album,
            artwork: initialTrack.artwork,
            duration: initialTrack.duration,
            audioUrl: initialTrack.audioUrl,
            genre: initialTrack.genre,
          }),
        });
      } catch {
        // Best-effort: try direct upsert
        await supabase.from('tracks').upsert({
          id: initialTrack.id,
          title: initialTrack.title,
          artist: initialTrack.artist,
          album: initialTrack.album,
          artwork: initialTrack.artwork,
          duration: initialTrack.duration,
          audio_url: initialTrack.audioUrl,
          genre: initialTrack.genre,
        }, { onConflict: 'id' });
      }

      const { error: insertErr } = await supabase.from('rooms').insert({
        id: newRoom.id,
        name: newRoom.name,
        description: newRoom.description,
        artwork: newRoom.artwork,
        host_id: dbHostId,
        is_live: true,
        listener_count: 1,
        current_track_id: initialTrack.id,
        settings: newRoom.settings,
      });

      if (insertErr) {
        console.error('[roomService] Supabase insert room error:', insertErr);
        // Fallback retry with null host_id if foreign key was rejected
        if (dbHostId) {
          await supabase.from('rooms').insert({
            id: newRoom.id,
            name: newRoom.name,
            description: newRoom.description,
            artwork: newRoom.artwork,
            host_id: null,
            is_live: true,
            listener_count: 1,
            current_track_id: initialTrack.id,
            settings: newRoom.settings,
          });
        }
      }
    }

    // Add to demo store with actual room host
    roomsStore = [newRoom, ...roomsStore];
    membersStore[newRoom.id] = [
      {
        id: `mem_${newRoom.host.id}`,
        roomId: newRoom.id,
        user: newRoom.host,
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
        track: initialTrack,
        addedBy: newRoom.host,
        addedAt: new Date().toISOString(),
        votes: 1,
        hasVoted: true,
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

    if (membersStore[roomId]) {
      return membersStore[roomId];
    }

    const r = roomsStore.find((room) => room.id.toLowerCase() === roomId.toLowerCase());
    if (r?.host) {
      return [
        {
          id: `mem_${r.host.id}`,
          roomId,
          user: r.host,
          role: 'host',
          status: 'host',
          statusText: 'Host',
          joinedAt: r.createdAt || new Date().toISOString(),
          isSynced: true,
          driftMs: 0,
        },
      ];
    }

    return [];
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

    const isUuid = (val?: string) =>
      Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

    if (isSupabaseConfigured && supabase && isUuid(user?.id)) {
      try {
        await supabase.from('room_members').upsert({
          id: newMember.id,
          room_id: roomId,
          user_id: user.id,
          role: newMember.role,
          status: newMember.status,
          status_text: newMember.statusText,
          drift_ms: newMember.driftMs,
        });
      } catch (err) {
        console.warn('[roomService] joinRoom member upsert skipped:', err);
      }
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
      // Ensure the track exists in the tracks table before creating the
      // queue_item. Without this upsert, open-library tracks (which are
      // in-memory only) would violate the queue_items.track_id FK and
      // disappear on page refresh.
      try {
        await fetch('/api/admin?action=upsert-track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: track.id,
            title: track.title,
            artist: track.artist,
            album: track.album,
            artwork: track.artwork,
            duration: track.duration,
            audioUrl: track.audioUrl,
            genre: track.genre,
          }),
        });
      } catch {
        // Best-effort: if the admin API is unavailable, try direct upsert
        await supabase.from('tracks').upsert({
          id: track.id,
          title: track.title,
          artist: track.artist,
          album: track.album,
          artwork: track.artwork,
          duration: track.duration,
          audio_url: track.audioUrl,
          genre: track.genre,
        }, { onConflict: 'id' });
      }

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
