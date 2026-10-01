import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Radio, Headphones, Sparkles, Music2, Users, ArrowRight, Zap, Globe2 } from 'lucide-react';
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
    <div className="w-full flex flex-col items-center pb-24 md:pb-12">
      
      {/* Hero Section */}
      <section className="relative w-full overflow-hidden flex flex-col items-center pt-24 pb-32 px-4 sm:px-6 lg:px-8 border-b border-white/5">
        <div className="absolute inset-0 bg-grid-pattern opacity-60 pointer-events-none" />
        
        {/* Animated ambient blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[400px] bg-accent-emerald/20 filter blur-[120px] rounded-[100%] pointer-events-none mix-blend-screen animate-pulse-subtle" />

        <div className="relative z-10 flex flex-col items-center text-center max-w-4xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-premium border-accent-emerald/30 text-xs font-bold text-accent-emerald uppercase tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.15)] animate-fade-up">
            <Sparkles className="w-4 h-4" />
            <span className="mt-0.5">The New Standard in Social Listening</span>
          </div>

          <h1 className="text-6xl sm:text-8xl lg:text-[7rem] font-black tracking-tighter text-white font-display leading-[0.9] drop-shadow-2xl animate-fade-up" style={{ animationDelay: '0.1s' }}>
            LISTEN
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-accent-cyan to-accent-emerald inline-block mt-2">
              TOGETHER.
            </span>
          </h1>
          
          <p className="text-text-secondary text-lg sm:text-2xl max-w-2xl leading-relaxed font-medium text-balance animate-fade-up" style={{ animationDelay: '0.2s' }}>
            Experience the ultimate browser-first social listening platform. Create a room, invite friends, and play music in perfect sync with crystal clear quality.
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4 animate-fade-up" style={{ animationDelay: '0.3s' }}>
            <Link
              to="/create"
              className="group relative inline-flex items-center gap-3 px-8 py-4 bg-white text-black font-bold text-base rounded-full hover:bg-accent-cream transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.4)] hover:-translate-y-1 active:scale-[0.97] overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
              <Radio className="w-5 h-5 relative z-10" />
              <span className="relative z-10">Start Broadcasting</span>
              <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/rooms"
              className="inline-flex items-center gap-3 px-8 py-4 glass-premium text-white font-semibold text-base rounded-full hover:bg-white/10 transition-all hover:-translate-y-1 active:scale-[0.97]"
            >
              <Headphones className="w-5 h-5" />
              Explore Rooms
            </Link>
          </div>
        </div>
      </section>

      {/* Bento Grid Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 w-full">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl sm:text-5xl font-black text-white font-display">Crafted for Excellence</h2>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto">Discover a feature set designed to elevate your shared audio experiences to new heights.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[280px]">
          {/* Large Bento Item */}
          <div className="md:col-span-2 glass-premium rounded-[2.5rem] p-10 flex flex-col justify-end relative overflow-hidden group hover:border-white/20 transition-colors">
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent-cyan/10 rounded-full filter blur-[80px] group-hover:bg-accent-cyan/20 transition-colors duration-500" />
            <div className="absolute -top-10 -right-10 opacity-10 group-hover:opacity-20 transition-opacity duration-500 group-hover:rotate-12 transform">
              <Users className="w-64 h-64 text-accent-cyan" />
            </div>
            
            <div className="relative z-10 max-w-md">
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-6 backdrop-blur-md border border-white/5">
                <Zap className="w-7 h-7 text-accent-cyan" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Real-Time Sync Engine</h3>
              <p className="text-text-secondary leading-relaxed text-lg">
                Experience ultra-low latency playback synchronization. When you pause or skip, the entire room follows instantly.
              </p>
            </div>
          </div>

          {/* Tall Bento Item */}
          <div className="md:col-span-1 md:row-span-2 glass-premium rounded-[2.5rem] p-10 flex flex-col relative overflow-hidden group hover:border-white/20 transition-colors">
            <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-accent-emerald/10 to-transparent" />
            <div className="flex-1">
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-6 backdrop-blur-md border border-white/5">
                <Music2 className="w-7 h-7 text-accent-emerald" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Audiophile Quality</h3>
              <p className="text-text-secondary leading-relaxed">
                Stream in pristine quality. Upload your own tracks or choose from our curated open-source library without compromise.
              </p>
            </div>
            {/* Visual decoration */}
            <div className="mt-8 relative h-40 w-full rounded-2xl border border-white/10 bg-black/40 overflow-hidden flex items-center justify-center">
              <div className="flex items-end gap-1.5 h-16 opacity-70">
                {[40, 70, 30, 90, 50, 100, 60, 80, 40].map((h, i) => (
                  <div key={i} className="w-2 bg-accent-emerald rounded-full animate-pulse-subtle" style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            </div>
          </div>

          {/* Standard Bento Item */}
          <div className="md:col-span-1 glass-premium rounded-[2.5rem] p-8 flex flex-col justify-center relative overflow-hidden group hover:border-white/20 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-5 backdrop-blur-md border border-white/5">
              <Globe2 className="w-6 h-6 text-accent-cream" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Global Community</h3>
            <p className="text-text-secondary leading-relaxed">
              Open your room to the world or host private VIP listening parties.
            </p>
          </div>

          {/* Standard Bento Item */}
          <div className="md:col-span-1 glass-premium rounded-[2.5rem] p-8 flex flex-col justify-center relative overflow-hidden group hover:border-white/20 transition-colors text-center items-center">
            <h3 className="text-4xl font-black text-white mb-2">99.9%</h3>
            <p className="text-text-secondary font-medium uppercase tracking-wider text-sm">Uptime Reliability</p>
          </div>
        </div>
      </section>

      {/* Featured Room Peek */}
      {featuredRoom && (
        <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative mb-12">
          <div className="glass-premium rounded-[3rem] overflow-hidden border border-white/10 p-2 group">
            <div className="relative rounded-[2.5rem] overflow-hidden bg-black">
              <img src={featuredRoom.artwork} className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-luminosity scale-105 group-hover:scale-100 transition-transform duration-1000" alt="" />
              <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/80 to-transparent z-10" />
              
              <div className="relative z-20 p-8 sm:p-16 flex flex-col md:flex-row items-center justify-between gap-12">
                <div className="max-w-xl">
                  <div className="flex items-center gap-3 mb-6">
                    <LiveBadge />
                    <span className="text-sm font-bold text-accent-cyan tracking-widest uppercase">Now Featured</span>
                  </div>
                  <h2 className="text-4xl sm:text-5xl font-black text-white mb-4 leading-tight">{featuredRoom.name}</h2>
                  <p className="text-text-secondary text-lg mb-8 line-clamp-2 leading-relaxed">{featuredRoom.description}</p>
                  
                  <Link
                    to={`/room/${featuredRoom.id}`}
                    className="inline-flex items-center gap-3 px-8 py-4 bg-white text-black font-bold rounded-full hover:bg-accent-cream transition-all hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] active:scale-[0.98]"
                  >
                    Join Session <ArrowRight className="w-5 h-5" />
                  </Link>
                </div>
                
                <div className="shrink-0 relative">
                  <div className="w-56 h-56 rounded-3xl overflow-hidden shadow-2xl border border-white/10 relative transform -rotate-3 group-hover:rotate-0 transition-transform duration-700">
                    <img src={featuredRoom.artwork} alt={featuredRoom.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 ring-1 ring-inset ring-white/20 rounded-3xl pointer-events-none" />
                  </div>
                  {/* Host avatar */}
                  <div className="absolute -bottom-6 -left-6 w-16 h-16 rounded-full border-4 border-[#0e1012] overflow-hidden bg-surface shadow-2xl z-30">
                    <img src={featuredRoom.host.avatar} alt={featuredRoom.host.username} className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

