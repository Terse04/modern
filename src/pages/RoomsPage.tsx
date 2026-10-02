import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, ArrowRight, Radio, Plus } from 'lucide-react';
import { Room } from '../types';
import { roomService } from '../services/roomService';
import { LiveBadge } from '../components/ui/Badge';

const EqBars: React.FC = () => (
  <div className="flex items-end gap-0.5 h-3 flex-shrink-0">
    <div className="w-0.5 bg-accent-cream animate-[eq_1s_ease-in-out_infinite] rounded-full" style={{ height: '40%' }} />
    <div className="w-0.5 bg-accent-cream animate-[eq_1s_ease-in-out_infinite_0.2s] rounded-full" style={{ height: '90%' }} />
    <div className="w-0.5 bg-accent-cream animate-[eq_1s_ease-in-out_infinite_0.4s] rounded-full" style={{ height: '60%' }} />
  </div>
);

const RoomCard: React.FC<{ room: Room }> = ({ room }) => (
  <Link
    to={`/room/${room.id}`}
    className="group relative block aspect-[4/5] overflow-hidden rounded-3xl ring-1 ring-white/10 hover:ring-accent-cyan/50 focus-visible:ring-2 focus-visible:ring-accent-cyan transition-all duration-500 surface shadow-lg hover:-translate-y-1"
  >
    <img
      src={room.artwork}
      alt={room.name}
      className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
      loading="lazy"
    />
    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />

    {/* Top Badges */}
    <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
      <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
        <img
          src={room.host.avatar}
          alt={room.host.name}
          className="w-5 h-5 rounded-full object-cover ring-1 ring-white/30"
        />
        <span className="text-[11px] font-semibold text-white/90 truncate max-w-[100px]">
          @{room.host.username}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {room.isLive && <LiveBadge size="sm" />}
        <div className="flex items-center gap-1 text-[11px] font-bold text-white bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
          <Users className="w-3 h-3 text-accent-cream" />
          <span>{room.listenerCount}</span>
        </div>
      </div>
    </div>

    {/* Bottom Info & Now Playing */}
    <div className="absolute inset-x-0 bottom-0 p-5 z-10 flex flex-col justify-end">
      <h3 className="truncate text-xl font-bold text-white tracking-tight font-display group-hover:text-accent-cream transition-colors">
        {room.name}
      </h3>
      {room.currentTrack ? (
        <p className="mt-1 flex items-center gap-2 text-xs text-white/80">
          <EqBars />
          <span className="truncate">
            {room.currentTrack.title} · {room.currentTrack.artist}
          </span>
        </p>
      ) : (
        <p className="mt-1 text-xs text-white/60 truncate">{room.description || 'Live audio sanctuary'}</p>
      )}
      <span className="mt-3 inline-flex translate-y-2 items-center gap-1.5 text-xs font-semibold text-accent-cream opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
        <span>Join room</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </span>
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 pb-24 md:pb-12 space-y-12">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 surface p-8 rounded-[2rem] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-emerald/5 rounded-full filter blur-[80px]" />

        <div className="relative z-10">
          <h1 className="text-4xl sm:text-5xl font-black text-white font-display tracking-tight mb-3">Live Rooms</h1>
          <p className="text-text-secondary text-base sm:text-lg max-w-xl">
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

      {/* Live Rooms Grid with Host-A-Room End Tile */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1.5 h-5 rounded-full bg-accent-emerald shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
          <h2 className="text-xl font-bold tracking-tight text-white font-display">
            Active Now
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] rounded-3xl bg-surface-elevated/50 animate-pulse border border-border/30" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
            
            {/* Host-A-Room Tile in the Grid */}
            <Link
              to="/create"
              className="grid aspect-[4/5] place-items-center rounded-3xl border border-dashed border-white/15 text-white/60 transition-all duration-300 hover:border-accent-cyan/60 hover:text-white hover:bg-white/[0.02] group"
            >
              <span className="flex flex-col items-center gap-3 text-center px-6">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Plus className="w-6 h-6 text-accent-cyan" />
                </div>
                <div>
                  <span className="font-bold text-sm block text-white">Host a room</span>
                  <span className="text-xs text-text-muted mt-0.5 block">Start broadcasting your sound</span>
                </div>
              </span>
            </Link>
          </div>
        )}
      </section>

      {/* Only show Trending section if there are 4+ rooms to avoid repeating the single room */}
      {rooms.length >= 4 && (
        <section className="surface rounded-[2rem] p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1.5 h-5 rounded-full bg-accent-cyan shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
            <h2 className="text-xl font-bold tracking-tight text-white font-display">
              Trending Communities
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {rooms.slice(2).map((room) => (
              <Link
                key={room.id}
                to={`/room/${room.id}`}
                className="group flex items-center gap-4 p-3 rounded-2xl bg-surface-elevated/40 hover:bg-surface-elevated border border-transparent hover:border-border/60 transition-all"
              >
                <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 shadow-md">
                  <img src={room.artwork} alt={room.name} className="w-full h-full object-cover" loading="lazy" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-text-primary truncate group-hover:text-accent-cream transition-colors">{room.name}</h4>
                  <p className="text-xs text-text-secondary truncate mt-0.5">{room.currentTrack?.artist || 'Various Artists'}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

