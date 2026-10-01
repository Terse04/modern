import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, ChevronRight, Headphones, Radio } from 'lucide-react';
import { Room } from '../types';
import { roomService } from '../services/roomService';
import { LiveBadge } from '../components/ui/Badge';

const RoomCard: React.FC<{ room: Room; featured?: boolean }> = ({ room, featured }) => (
  <Link
    to={`/room/${room.id}`}
    className={`group relative overflow-hidden rounded-3xl border border-border/40 hover:border-accent-cream/30 bg-surface transition-all duration-500 hover:shadow-[0_0_40px_rgba(242,239,233,0.15)] hover:-translate-y-1 ${
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
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
      <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-500" />

      {/* Top badges */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5 bg-black/40 backdrop-blur-md pr-3 p-1 rounded-full border border-white/10">
          <img
            src={room.host.avatar}
            alt={room.host.name}
            className="w-6 h-6 rounded-full object-cover ring-2 ring-white/20"
          />
          <span className="text-xs font-semibold text-white/90">
            @{room.host.username}
          </span>
        </div>
        {room.isLive && <LiveBadge size="sm" />}
      </div>

      {/* Listener count pill */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5 text-xs font-bold text-white bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg border border-white/10">
        <Users className="w-3.5 h-3.5 text-accent-cream" />
        <span>{room.listenerCount}</span>
      </div>

      {/* Now playing indicator */}
      {room.currentTrack && (
        <div className="absolute bottom-20 left-6 right-6 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0">
          <div className="flex items-end gap-0.5 h-4 flex-shrink-0">
            <div className="w-0.5 bg-accent-cream animate-pulse rounded-full" style={{ height: '50%' }} />
            <div className="w-0.5 bg-accent-cream animate-pulse rounded-full" style={{ height: '100%', animationDelay: '0.15s' }} />
            <div className="w-0.5 bg-accent-cream animate-pulse rounded-full" style={{ height: '60%', animationDelay: '0.3s' }} />
          </div>
          <span className="text-xs font-medium text-white/90 truncate drop-shadow-md">
            {room.currentTrack.title} — {room.currentTrack.artist}
          </span>
        </div>
      )}

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <h3 className="text-xl font-bold text-white tracking-tight font-display line-clamp-1 group-hover:text-accent-cream transition-colors">
          {room.name}
        </h3>
        <p className="text-sm text-white/70 mt-1.5 line-clamp-2 leading-relaxed">{room.description}</p>
      </div>
    </div>
  </Link>
);

const SmallRoomCard: React.FC<{ room: Room }> = ({ room }) => (
  <Link
    to={`/room/${room.id}`}
    className="group flex items-center gap-4 p-3 rounded-2xl bg-surface-elevated/40 hover:bg-surface-elevated border border-transparent hover:border-border/60 transition-all hover:shadow-lg"
  >
    <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 shadow-md">
      <img
        src={room.artwork}
        alt={room.name}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        loading="lazy"
      />
      {room.isLive && (
        <div className="absolute bottom-1 left-1">
          <LiveBadge size="sm" />
        </div>
      )}
    </div>
    <div className="min-w-0 flex-1">
      <h4 className="text-base font-bold text-text-primary truncate group-hover:text-accent-cream transition-colors">{room.name}</h4>
      <p className="text-sm text-text-secondary truncate mt-0.5">{room.currentTrack?.artist || 'Various Artists'}</p>
      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-text-muted font-medium">
        <Users className="w-3.5 h-3.5" />
        <span>{room.listenerCount} listening</span>
      </div>
    </div>
    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">
      <ChevronRight className="w-4 h-4 text-white" />
    </div>
  </Link>
);

export const RoomsPage: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    roomService.getLiveRooms().then((r) => {
      setRooms(r);
      setLoading(false);
    });
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 pb-24 md:pb-12 space-y-16">
      
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-surface-elevated/30 p-8 rounded-[2rem] border border-border/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-emerald/5 rounded-full filter blur-[80px]" />
        
        <div className="relative z-10">
          <h1 className="text-4xl sm:text-5xl font-black text-white font-display tracking-tight mb-3">Live Rooms</h1>
          <p className="text-text-secondary text-lg max-w-xl">
            Drop into active sessions, discover new music, and listen in perfect sync with people around the world.
          </p>
        </div>
        <div className="relative z-10 shrink-0">
          <Link
            to="/create"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-bold text-sm rounded-full hover:bg-accent-cream transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
          >
            <Radio className="w-4 h-4" />
            Host a Room
          </Link>
        </div>
      </div>

      {/* Live Rooms Grid */}
      <section>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-1.5 h-6 rounded-full bg-accent-emerald shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
          <h2 className="text-2xl font-bold tracking-tight text-white font-display">
            Active Now
          </h2>
        </div>
        
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] rounded-[2rem] bg-surface-elevated/50 animate-pulse border border-border/30" />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="p-12 rounded-[2.5rem] border-2 border-dashed border-border/40 text-center space-y-5 bg-surface/20">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-surface-elevated border border-border/60 flex items-center justify-center shadow-inner">
              <Headphones className="w-8 h-8 text-text-muted" />
            </div>
            <div className="space-y-2 max-w-sm mx-auto">
              <p className="text-xl font-bold text-white">It's quiet in here...</p>
              <p className="text-sm text-text-muted leading-relaxed">There are no active rooms right now. Be the first to start a listening session!</p>
            </div>
            <Link
              to="/create"
              className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-surface-elevated hover:bg-white text-white hover:text-black font-bold text-sm rounded-full transition-all border border-border/60"
            >
              Start Broadcasting
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        )}
      </section>

      {/* Trending / Recommended (Just another view of rooms for now) */}
      {rooms.length > 0 && (
        <section className="bg-surface-elevated/20 border border-border/30 rounded-[2rem] p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1.5 h-6 rounded-full bg-accent-cyan shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
            <h2 className="text-xl font-bold tracking-tight text-white font-display">
              Trending Communities
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {rooms.map((room) => (
              <SmallRoomCard key={room.id} room={room} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
