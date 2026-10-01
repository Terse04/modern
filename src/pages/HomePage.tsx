import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Radio, Headphones, Sparkles, Disc3, Music2, Users } from 'lucide-react';
import { roomService } from '../services/roomService';
import { Room } from '../types';
import { LiveBadge } from '../components/ui/Badge';

export const HomePage: React.FC = () => {
  const [featuredRoom, setFeaturedRoom] = useState<Room | null>(null);

  useEffect(() => {
    roomService.getLiveRooms().then((r) => {
      if (r.length > 0) setFeaturedRoom(r[0]);
    });
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-12 space-y-16">
      
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-[2rem] sm:rounded-[3rem] bg-gradient-to-br from-surface-elevated via-surface to-bg border border-border/40 p-8 sm:p-12 lg:p-20 shadow-2xl">
        {/* Animated ambient blobs */}
        <div className="absolute inset-0 opacity-[0.15] pointer-events-none mix-blend-screen">
          <div className="absolute top-1/4 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-accent-emerald rounded-full filter blur-[100px] sm:blur-[120px] animate-float-slow" />
          <div className="absolute bottom-1/4 right-1/4 w-48 sm:w-72 h-48 sm:h-72 bg-accent-cyan rounded-full filter blur-[80px] sm:blur-[100px] animate-float-slow" style={{ animationDelay: '3s' }} />
          <div className="absolute top-1/2 left-1/2 w-40 sm:w-56 h-40 sm:h-56 bg-accent-cream rounded-full filter blur-[90px]" />
        </div>

        {/* Decorative floating icon */}
        <div className="absolute -top-10 -right-10 sm:top-8 sm:right-8 opacity-[0.05] animate-spin-slow">
          <Disc3 className="w-48 h-48 sm:w-80 sm:h-80" />
        </div>

        <div className="relative z-10 flex flex-col items-start max-w-2xl">
          <div className="flex items-center gap-2 mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-emerald/15 border border-accent-emerald/30 text-xs font-bold text-accent-emerald uppercase tracking-widest shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <Sparkles className="w-3.5 h-3.5" />
              Social Listening
            </span>
          </div>

          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tighter text-white font-display leading-[0.9] drop-shadow-lg">
            LISTEN
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-cream via-accent-cyan to-accent-emerald">TOGETHER.</span>
          </h1>
          <p className="text-text-secondary text-base sm:text-xl mt-6 max-w-lg leading-relaxed font-medium">
            Create a room. Invite friends. Play music in perfect sync. 
            The ultimate browser-first social listening experience.
          </p>
          
          <div className="flex flex-wrap items-center gap-4 mt-10">
            <Link
              to="/create"
              className="group relative inline-flex items-center gap-2 px-8 py-4 bg-accent-cream text-bg font-bold text-base rounded-full hover:bg-white transition-all shadow-[0_0_30px_rgba(242,239,233,0.3)] hover:shadow-[0_0_40px_rgba(242,239,233,0.5)] hover:-translate-y-1 active:scale-[0.97] overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              <Radio className="w-5 h-5 relative z-10" />
              <span className="relative z-10">Start Broadcasting</span>
            </Link>
            <Link
              to="/rooms"
              className="inline-flex items-center gap-2 px-8 py-4 bg-surface-elevated/80 backdrop-blur-md text-white font-semibold text-base rounded-full border border-white/10 hover:border-white/30 hover:bg-surface-hover transition-all hover:-translate-y-1 active:scale-[0.97]"
            >
              <Headphones className="w-5 h-5" />
              Explore Rooms
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-elevated/50 backdrop-blur-sm border border-border/40 p-8 rounded-[2rem] hover:bg-surface-elevated transition-colors group">
          <div className="w-14 h-14 rounded-2xl bg-accent-cyan/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
            <Users className="w-7 h-7 text-accent-cyan" />
          </div>
          <h3 className="text-xl font-bold text-white mb-3">Sync with Friends</h3>
          <p className="text-text-secondary leading-relaxed">
            Real-time playback synchronization. When you pause, everyone pauses. When you skip, everyone skips.
          </p>
        </div>
        
        <div className="bg-surface-elevated/50 backdrop-blur-sm border border-border/40 p-8 rounded-[2rem] hover:bg-surface-elevated transition-colors group">
          <div className="w-14 h-14 rounded-2xl bg-accent-emerald/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
            <Music2 className="w-7 h-7 text-accent-emerald" />
          </div>
          <h3 className="text-xl font-bold text-white mb-3">High Quality Audio</h3>
          <p className="text-text-secondary leading-relaxed">
            Upload your own tracks or choose from our curated open-source library in crystal clear quality.
          </p>
        </div>

        <div className="bg-surface-elevated/50 backdrop-blur-sm border border-border/40 p-8 rounded-[2rem] hover:bg-surface-elevated transition-colors group">
          <div className="w-14 h-14 rounded-2xl bg-accent-cream/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
            <Radio className="w-7 h-7 text-accent-cream" />
          </div>
          <h3 className="text-xl font-bold text-white mb-3">Public or Private</h3>
          <p className="text-text-secondary leading-relaxed">
            Host private listening parties with invite links, or open your room to the world on the discover page.
          </p>
        </div>
      </section>

      {/* Featured Room Peek */}
      {featuredRoom && (
        <section className="relative rounded-[2rem] overflow-hidden border border-border/40">
          <div className="absolute inset-0 bg-surface-elevated" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/80 to-transparent z-10" />
          <img src={featuredRoom.artwork} className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-luminosity" alt="" />
          
          <div className="relative z-20 p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-xl">
              <div className="flex items-center gap-3 mb-4">
                <LiveBadge />
                <span className="text-sm font-medium text-accent-cream tracking-wide uppercase">Featured Room</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2">{featuredRoom.name}</h2>
              <p className="text-text-secondary mb-6 line-clamp-2">{featuredRoom.description}</p>
              
              <Link
                to={`/room/${featuredRoom.id}`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-bold rounded-full hover:bg-accent-cream transition-colors"
              >
                Join Now
              </Link>
            </div>
            
            <div className="shrink-0 relative group">
              <div className="w-48 h-48 rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative">
                <img src={featuredRoom.artwork} alt={featuredRoom.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
              </div>
              {/* Host avatar */}
              <div className="absolute -bottom-4 -right-4 w-12 h-12 rounded-full border-4 border-surface-elevated overflow-hidden bg-surface">
                <img src={featuredRoom.host.avatar} alt={featuredRoom.host.username} className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
