// Core Data Models for Modern Social Listening Platform

export type VisibilityType = 'public' | 'unlisted' | 'private';
export type PlaybackPermission = 'host_only' | 'everyone' | 'voting';
export type MemberRole = 'host' | 'co_host' | 'listener';
export type MemberStatus = 'listening' | 'joined' | 'reacting' | 'host' | 'idle';

export interface User {
  id: string;
  username: string;
  name: string;
  avatar: string;
  isHost?: boolean;
  isAdmin?: boolean;
  isBanned?: boolean;
  role?: MemberRole | 'admin';
}

export interface PlatformSettings {
  guestDailyRoomLimit: number;
  maxListenersPerRoom: number;
  availableGenres: string[];
  availableTags: string[];
  allowedBitrates: number[];
  allowGuestCreation: boolean;
  maintenanceMode: boolean;
}

export interface Profile {
  id: string;
  username: string;
  name: string;
  bio?: string;
  avatar: string;
  currentStatus: string;
  isAdmin?: boolean;
  isBanned?: boolean;
  stats: {
    roomsCreated: number;
    roomsJoined: number;
    tracksPlayed: number;
    listeningStreakDays: number;
    listeningHours: number;
  };
  favoriteTracks: Track[];
  recentRooms: {
    id: string;
    name: string;
    artwork: string;
    lastVisited: string;
  }[];
  friends: {
    id: string;
    name: string;
    username: string;
    avatar: string;
    status: MemberStatus;
    statusText: string;
  }[];
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: number; // in seconds
  audioUrl: string;
  genre?: string;
}

export interface QueueItem {
  id: string;
  roomId: string;
  track: Track;
  addedBy: User;
  addedAt: string;
  votes: number;
  hasVoted?: boolean;
}

export interface RoomMember {
  id: string;
  roomId: string;
  user: User;
  role: MemberRole;
  status: MemberStatus;
  statusText?: string;
  activeReaction?: string;
  joinedAt: string;
  isSynced: boolean;
  driftMs: number;
  speechBubble?: {
    text: string;
    expiresAt: number;
  };
}

export interface RoomSettings {
  allowChat: boolean;
  allowQueueAdditions: boolean;
  playbackPermissions: PlaybackPermission;
  visibility: VisibilityType;
  maxListeners: number;
  bitrateKbps: number;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  artwork: string;
  host: User;
  isLive: boolean;
  listenerCount: number;
  currentTrackId?: string;
  currentTrack?: Track;
  settings: RoomSettings;
  createdAt: string;
  tags?: string[];
}

export type PlaybackStatus = 'playing' | 'paused' | 'buffering' | 'ended' | 'idle';

export interface PlaybackState {
  trackId: string;
  status: PlaybackStatus;
  position: number; // in seconds
  serverTimestamp: number; // epoch ms
  revision: number;
  volume: number; // 0 to 1
  isMuted: boolean;
  isShuffled: boolean;
  isRepeating: boolean;
}

export interface ChatReaction {
  emoji: string;
  count: number;
  users: string[]; // user IDs
}

export interface ChatMessage {
  id: string;
  roomId: string;
  user: User;
  text: string;
  timestamp: string;
  isSystem?: boolean;
  reactions?: ChatReaction[];
}

export interface FloatingReaction {
  id: string;
  emoji: string;
  userId: string;
  userName: string;
  userAvatar: string;
  x: number; // percentage offset
}

export type SyncEventType =
  | 'PLAY'
  | 'PAUSE'
  | 'SEEK'
  | 'TRACK_CHANGE'
  | 'SYNC_HEARTBEAT'
  | 'QUEUE_UPDATE'
  | 'PRESENCE_SYNC'
  | 'CHAT_MESSAGE'
  | 'REACTION';

export interface SyncEvent<T = any> {
  id: string;
  roomId: string;
  type: SyncEventType;
  payload: T;
  timestamp: number;
  senderId: string;
  revision: number;
}

export interface DriftMetrics {
  driftMs: number;
  status: 'synced' | 'correcting' | 'desynced';
  latencyMs: number;
  lastCalculated: number;
}

export interface ListeningSession {
  id: string;
  userId: string;
  roomId: string;
  startedAt: string;
  endedAt?: string;
  secondsListened: number;
}
