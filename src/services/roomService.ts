import { Room, RoomMember, QueueItem, User, Track, RoomSettings } from '../types';
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // Ensure the initial track exists in the DB so the FK works safely
      let validTrackId: string | null = null;
      try {
        const { data: trackRow } = await supabase
          .from('tracks')
          .select('id')
          .eq('id', initialTrack.id)
          .maybeSingle();

        if (trackRow?.id) {
          validTrackId = trackRow.id;
        } else {
          const { error: trackErr } = await supabase.from('tracks').insert({
            id: initialTrack.id,
            title: initialTrack.title,
            artist: initialTrack.artist,
            album: initialTrack.album,
            artwork: initialTrack.artwork,
            duration: Math.max(1, Math.round(initialTrack.duration)),
            audio_url: initialTrack.audioUrl,
            genre: initialTrack.genre,
          });
          if (!trackErr) {
            validTrackId = initialTrack.id;
          }
        }
      } catch (err) {
        console.warn('[roomService] Could not check or insert initial track:', err);
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const hasSession = !!sessionData.session;
      let newHostId = hostUser.id;

      if (hasSession) {
        // Enforce the correct profile ID to avoid RLS violations if frontend state is stale
        const { data: profileId } = await supabase.rpc('current_profile_id');
        if (profileId) {
          newHostId = profileId;
        }

        const { error: insertErr } = await supabase.from('rooms').insert({
          id: newRoom.id,
          name: newRoom.name,
          description: newRoom.description,
          artwork: newRoom.artwork,
          host_id: newHostId,
          is_live: true,
          listener_count: 1,
          current_track_id: validTrackId,
          settings: newRoom.settings,
        });

        if (insertErr) {
          console.error('[roomService] Supabase insert room error:', insertErr);
          throw new Error(insertErr.message);
        }
      } else {
        let guestFingerprint = localStorage.getItem('modern_guest_fingerprint');
        if (!guestFingerprint) {
          guestFingerprint = `gfp_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;
          localStorage.setItem('modern_guest_fingerprint', guestFingerprint);
        }

        const { data: rpcData, error: rpcErr } = await supabase.rpc('create_room_guest', {
          p_fingerprint: guestFingerprint,
          p_name: newRoom.name,
          p_description: newRoom.description || '',
          p_playback_permissions: newRoom.settings.playbackPermissions,
          p_visibility: newRoom.settings.visibility,
          p_max_listeners: newRoom.settings.maxListeners || 50,
          p_allow_chat: newRoom.settings.allowChat,
          p_allow_queue: newRoom.settings.allowQueueAdditions
        });

        if (rpcErr) {
          console.error('[roomService] Guest room creation error:', rpcErr);
          throw new Error(rpcErr.message);
        }

        const parsedData = rpcData as { profile_id: string, room_id: string };
        newHostId = parsedData.profile_id;
        newRoom.host.id = newHostId;
        newRoom.id = parsedData.room_id;
      }
    } else {
      // Add to demo store only when not configured
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
    }

    return newRoom;
  },

  async updateRoom(
    roomId: string,
    updates: {
      name?: string;
      description?: string;
      artwork?: string;
      settings?: Partial<RoomSettings>;
    }
  ): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const payload: Record<string, unknown> = {};
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
            ...(updates.settings ? { settings: { ...r.settings, ...updates.settings } as RoomSettings } : {}),
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    if (isSupabaseConfigured && supabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        const { error } = await supabase.rpc('join_room', { p_room_id: roomId });
        if (error) {
          console.warn('[roomService] joinRoom rpc error:', error);
          throw new Error(error.message);
        }
      }
    } else {
      if (!membersStore[roomId]) {
        membersStore[roomId] = [];
      }
      membersStore[roomId] = [newMember, ...membersStore[roomId]];

      // Increment room listener count
      const r = roomsStore.find((room) => room.id === roomId);
      if (r) {
        r.listenerCount += 1;
      }
    }

    return newMember;
  },

  async leaveRoom(roomId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        await supabase.rpc('leave_room', { p_room_id: roomId });
      }
    }
  },

  async heartbeat(roomId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.rpc('room_heartbeat', { p_room_id: roomId });
      } catch {
        // ignore heartbeat errors
      }
    }
  },

  async getRoomQueue(roomId: string): Promise<QueueItem[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('queue_items')
        .select('*, track:tracks(*), added_by:profiles(*)')
        .eq('room_id', roomId)
        .order('votes', { ascending: false });

      if (!error && data && data.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // queue_item. Without this insert, in-memory tracks would violate
      // the queue_items.track_id FK and disappear on page refresh.
      try {
        const { data: trackRow } = await supabase
          .from('tracks')
          .select('id')
          .eq('id', track.id)
          .maybeSingle();

        if (!trackRow?.id) {
          await supabase.from('tracks').insert({
            id: track.id,
            title: track.title,
            artist: track.artist,
            album: track.album,
            artwork: track.artwork,
            duration: Math.max(1, Math.round(track.duration)),
            audio_url: track.audioUrl,
            genre: track.genre,
          });
        }
      } catch (err) {
        console.warn('[roomService] Could not check or insert queue track:', err);
      }

      let adderId: string | null = null;
      if (user?.id) {
        const { data: prof } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
        if (prof) adderId = prof.id;
      }

      await supabase.from('queue_items').insert({
        id: newItem.id,
        room_id: roomId,
        track_id: track.id,
        added_by_id: adderId,
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
    if (isSupabaseConfigured && supabase) {
      const { data: hasVoted, error } = await supabase.rpc('toggle_queue_vote', {
        p_queue_item_id: queueItemId
      });
      if (error) {
        console.error('[roomService] voteQueueItem rpc error:', error);
        return null;
      }

      // Fetch the updated queue item to get the real vote count
      const { data: q, error: fetchErr } = await supabase
        .from('queue_items')
        .select('*, track:tracks(*), added_by:profiles(*)')
        .eq('id', queueItemId)
        .single();

      if (!fetchErr && q) {
        return {
          id: q.id,
          roomId: q.room_id,
          track: q.track,
          addedBy: q.added_by,
          addedAt: q.added_at,
          votes: q.votes,
          hasVoted: hasVoted,
        };
      }
      return null;
    }

    // fallback for local mode
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
