import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Radio, ChevronRight, Headphones, Sparkles, Music2, Disc3 } from 'lucide-react';
import { Room } from '../types';
import { roomService } from '../services/roomService';
import { LiveBadge } from '../components/ui/Badge';

const RoomCard: React.FC<{ room: Room; featured?: boolean }> = ({ room, featured }) => (
  <Link
    to={`/room/${room.id}`}
    className={`group relative overflow-hidden rounded-2xl border border-border/40 hover:border-accent-cream/30 bg-surface transition-all duration-300 hover:shadow-artwork-glow hover:-translate-y-0.5 ${
      featured ? 'col-span-2 row-span-2 md:col-span-1' : ''
    }`}
  >
    {/* Artwork */}
    <div className="relative aspect-[4/3] overflow-hidden">
      <img
        src={room.artwork}
        alt={room.name}
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Top badges */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img
            src={room.host.avatar}
            alt={room.host.name}
            className="w-6 h-6 rounded-full object-cover ring-2 ring-white/20 shadow-md"
          />
          <span className="text-[11px] font-medium text-white/90 drop-shadow-sm">
            @{room.host.username}
          </span>
        </div>
        {room.isLive && <LiveBadge size="sm" />}
      </div>

      {/* Listener count pill */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 text-[11px] font-semibold text-white/90 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full shadow-sm">
        <Users className="w-3 h-3" />
        <span>{room.listenerCount}</span>
      </div>

      {/* Now playing indicator */}
      {room.currentTrack && (
        <div className="absolute bottom-12 left-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="flex items-end gap-0.5 h-3 flex-shrink-0">
            <div className="w-0.5 bg-accent-cream animate-pulse rounded-full" style={{ height: '50%' }} />
            <div className="w-0.5 bg-accent-cream animate-pulse rounded-full" style={{ height: '100%', animationDelay: '0.15s' }} />
            <div className="w-0.5 bg-accent-cream animate-pulse rounded-full" style={{ height: '60%', animationDelay: '0.3s' }} />
          </div>
          <span className="text-[10px] text-white/70 truncate">
            {room.currentTrack.title} — {room.currentTrack.artist}
          </span>
        </div>
      )}

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
    className="group flex items-center gap-3.5 p-2.5 rounded-xl hover:bg-surface-elevated/80 border border-transparent hover:border-border/40 transition-all"
  >
    <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 shadow-md">
      <img
        src={room.artwork}
        alt={room.name}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
        loading="lazy"
      />
      {room.isLive && (
        <div className="absolute bottom-0.5 left-0.5">
          <LiveBadge size="sm" />
        </div>
      )}
    </div>
    <div className="min-w-0 flex-1">
      <h4 className="text-sm font-semibold text-text-primary truncate group-hover:text-accent-cream transition-colors">{room.name}</h4>
      <p className="text-xs text-text-secondary truncate">{room.currentTrack?.artist || 'Various Artists'}</p>
      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-text-muted">
        <Users className="w-3 h-3" />
        <span>{room.listenerCount} listening</span>
      </div>
    </div>
    <ChevronRight className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-8 space-y-8 sm:space-y-12">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-surface-elevated via-surface to-bg border border-border/40 p-6 sm:p-10 lg:p-16">
        {/* Animated ambient blobs */}
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-48 sm:w-64 h-48 sm:h-64 bg-accent-emerald rounded-full filter blur-[100px] sm:blur-[120px] animate-float-slow" />
          <div className="absolute bottom-1/4 right-1/4 w-36 sm:w-48 h-36 sm:h-48 bg-accent-cyan rounded-full filter blur-[80px] sm:blur-[100px] animate-float-slow" style={{ animationDelay: '3s' }} />
          <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-accent-cream rounded-full filter blur-[90px]" />
        </div>

        {/* Decorative floating icon */}
        <div className="absolute top-4 right-4 sm:top-8 sm:right-8 opacity-[0.04]">
          <Disc3 className="w-24 h-24 sm:w-40 sm:h-40" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-emerald/10 border border-accent-emerald/25 text-[10px] sm:text-[11px] font-semibold text-accent-emerald uppercase tracking-wider">
              <Sparkles className="w-3 h-3" />
              Live Now
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-7xl font-extrabold tracking-tighter text-text-primary font-display leading-[0.9]">
            LISTEN
            <br />
            TOGETHER.
          </h1>
          <p className="text-text-secondary text-sm sm:text-base mt-3 sm:mt-4 max-w-md leading-relaxed">
            Create a room. Invite friends. Play music in perfect sync.
            Social listening, reimagined for the browser.
          </p>
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 mt-5 sm:mt-6">
            <Link
              to="/create"
              className="btn-glow inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-accent-cream text-bg font-semibold text-sm rounded-full hover:bg-accent-creamHover transition-all shadow-glow-subtle active:scale-[0.97]"
            >
              <Radio className="w-4 h-4" />
              Create Room
            </Link>
            <Link
              to="/join"
              className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-surface-elevated text-text-primary font-medium text-sm rounded-full border border-border hover:border-border-focus hover:bg-surface-hover transition-all active:scale-[0.97]"
            >
              <Headphones className="w-4 h-4" />
              Join Room
            </Link>
          </div>
        </div>
      </section>

      {/* Live Rooms */}
      <section>
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-1 h-5 rounded-full bg-accent-emerald" />
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-text-primary font-display uppercase">
              Live Rooms
            </h2>
          </div>
          <Link
            to="/rooms"
            className="flex items-center gap-1 text-xs font-medium text-text-muted hover:text-accent-cream transition-colors"
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
          <div className="p-8 sm:p-10 rounded-2xl border border-dashed border-border/70 text-center space-y-4 bg-surface/30">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-surface-elevated/80 border border-border/60 flex items-center justify-center">
              <Music2 className="w-7 h-7 text-text-muted" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-text-primary">No live rooms active right now</p>
              <p className="text-xs text-text-muted max-w-xs mx-auto">Create a room and invite your friends to start listening together in perfect sync!</p>
            </div>
            <Link
              to="/create"
              className="btn-glow inline-flex items-center gap-2 px-5 py-2.5 bg-accent-cream text-bg font-semibold text-xs rounded-full hover:bg-accent-creamHover transition-all shadow-glow-subtle"
            >
              <Radio className="w-3.5 h-3.5" />
              Start First Room
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        )}
      </section>

      {/* Trending Rooms */}
      {rooms.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-1 h-5 rounded-full bg-accent-cyan" />
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-text-primary font-display uppercase">
                Trending Rooms
              </h2>
            </div>
            <Link
              to="/rooms"
              className="flex items-center gap-1 text-xs font-medium text-text-muted hover:text-accent-cream transition-colors"
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

      {/* Bottom spacer for mobile nav */}
      <div className="h-2 md:hidden" />
    </div>
  );
};
