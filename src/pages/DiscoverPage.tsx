import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Radio, ChevronRight, Headphones } from 'lucide-react';
import { Room } from '../types';
import { roomService } from '../services/roomService';
import { LiveBadge } from '../components/ui/Badge';

const RoomCard: React.FC<{ room: Room; featured?: boolean }> = ({ room, featured }) => (
  <Link
    to={`/room/${room.id}`}
    className={`group relative overflow-hidden rounded-2xl border border-border/40 hover:border-border-focus bg-surface transition-all duration-300 hover:shadow-artwork-glow ${
      featured ? 'col-span-2 row-span-2 md:col-span-1' : ''
    }`}
  >
    {/* Artwork */}
    <div className="relative aspect-[4/3] overflow-hidden">
      <img
        src={room.artwork}
        alt={room.name}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Top badges */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img
            src={room.host.avatar}
            alt={room.host.name}
            className="w-6 h-6 rounded-full object-cover ring-1 ring-white/20"
          />
          <span className="text-[11px] font-medium text-white/80">
            @{room.host.username} is hosting
          </span>
        </div>
        {room.isLive && <LiveBadge size="sm" />}
      </div>

      {/* Listener count */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 text-[11px] font-medium text-white/70 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full">
        <Users className="w-3 h-3" />
        <span>{room.listenerCount} listening</span>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h3 className="text-base font-bold text-white tracking-tight font-display line-clamp-1">
          {room.name}
        </h3>
        <p className="text-xs text-white/60 mt-1 line-clamp-1">{room.description}</p>
      </div>
    </div>
  </Link>
);

const SmallRoomCard: React.FC<{ room: Room }> = ({ room }) => (
  <Link
    to={`/room/${room.id}`}
    className="group flex items-center gap-3.5 p-2 rounded-xl hover:bg-surface-elevated transition-colors"
  >
    <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
      <img
        src={room.artwork}
        alt={room.name}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
      />
      {room.isLive && (
        <div className="absolute bottom-1 left-1">
          <LiveBadge size="sm" />
        </div>
      )}
    </div>
    <div className="min-w-0 flex-1">
      <h4 className="text-sm font-semibold text-text-primary truncate">{room.name}</h4>
      <p className="text-xs text-text-secondary truncate">{room.currentTrack?.artist || 'Various Artists'}</p>
      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-text-muted">
        <Users className="w-3 h-3" />
        <span>{room.listenerCount}</span>
      </div>
    </div>
  </Link>
);

export const DiscoverPage: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    roomService.getLiveRooms().then((r) => {
      setRooms(r);
      setLoading(false);
    });
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 space-y-12">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-surface-elevated via-surface to-bg border border-border/40 p-8 sm:p-12 lg:p-16">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-accent-emerald rounded-full filter blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-accent-cyan rounded-full filter blur-[100px]" />
        </div>
        <div className="relative z-10">
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tighter text-text-primary font-display leading-none">
            LISTEN
            <br />
            TOGETHER.
          </h1>
          <p className="text-text-secondary text-sm sm:text-base mt-4 max-w-md">
            Create a room. Invite friends. Play music in perfect sync.
            Social listening, reimagined for the browser.
          </p>
          <div className="flex items-center gap-3 mt-6">
            <Link
              to="/create"
              className="inline-flex items-center gap-2 px-6 py-3 bg-accent-cream text-bg font-semibold text-sm rounded-full hover:bg-accent-creamHover transition-colors shadow-sm active:scale-[0.98]"
            >
              <Radio className="w-4 h-4" />
              Create Room
            </Link>
            <Link
              to="/join"
              className="inline-flex items-center gap-2 px-6 py-3 bg-surface-elevated text-text-primary font-medium text-sm rounded-full border border-border hover:border-border-focus transition-colors active:scale-[0.98]"
            >
              <Headphones className="w-4 h-4" />
              Join Room
            </Link>
          </div>
        </div>
      </section>

      {/* Live Rooms */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold tracking-tight text-text-primary font-display uppercase">
            Live Rooms
          </h2>
          <Link
            to="/rooms"
            className="flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text-secondary transition-colors"
          >
            See all <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] rounded-2xl bg-surface-elevated animate-pulse" />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-border/70 text-center space-y-3">
            <p className="text-sm font-semibold text-text-primary">No live rooms active right now</p>
            <p className="text-xs text-text-muted">Create a room and invite your friends to start listening!</p>
            <Link
              to="/create"
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent-cream text-bg font-semibold text-xs rounded-full hover:bg-accent-creamHover transition-colors"
            >
              <Radio className="w-3.5 h-3.5" />
              Start First Room
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        )}
      </section>

      {/* Trending Rooms */}
      {rooms.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold tracking-tight text-text-primary font-display uppercase">
              Trending Rooms
            </h2>
            <Link
              to="/rooms"
              className="flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text-secondary transition-colors"
            >
              See all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {rooms.map((room) => (
              <SmallRoomCard key={room.id} room={room} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
