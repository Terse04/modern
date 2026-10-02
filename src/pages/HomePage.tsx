import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Radio, Headphones, Sparkles, Music2, ArrowRight, Zap, Globe2 } from 'lucide-react';
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
      <section className="relative w-full overflow-hidden pt-20 pb-32 px-4 sm:px-6 lg:px-8 border-b border-white/5 min-h-[90vh] flex items-center">
        <div className="absolute inset-0 bg-grid-pattern opacity-60 pointer-events-none" />
        
        {/* Animated ambient blobs */}
        <div className="absolute top-0 left-0 w-full max-w-3xl h-[600px] bg-accent-emerald/10 filter blur-[120px] rounded-[100%] pointer-events-none mix-blend-screen animate-pulse-subtle" />
        <div className="absolute bottom-0 right-0 w-full max-w-3xl h-[600px] bg-accent-cyan/10 filter blur-[120px] rounded-[100%] pointer-events-none mix-blend-screen animate-pulse-subtle" style={{ animationDelay: '2s' }} />

        <div className="max-w-7xl mx-auto w-full relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          {/* Left Text */}
          <div className="flex flex-col items-start text-left space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-premium border-accent-emerald/30 text-xs font-bold text-accent-emerald uppercase tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.15)] animate-fade-up">
              <Sparkles className="w-4 h-4" />
              <span className="mt-0.5">The New Standard in Social Listening</span>
            </div>

            <h1 className="text-[clamp(2.75rem,8vw,5.5rem)] font-black tracking-[-0.03em] text-white font-display leading-[0.95] drop-shadow-2xl animate-fade-up" style={{ animationDelay: '0.1s' }}>
              LISTEN
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-accent-cyan to-accent-emerald inline-block mt-2">
                TOGETHER.
              </span>
            </h1>
            
            <p className="text-text-secondary text-lg sm:text-2xl max-w-lg leading-relaxed font-medium animate-fade-up" style={{ animationDelay: '0.2s' }}>
              Experience the ultimate browser-first social listening platform. Create a room, invite friends, and play music in perfect sync.
            </p>
            
            <div className="flex flex-wrap items-center gap-4 pt-4 animate-fade-up" style={{ animationDelay: '0.3s' }}>
              <Link
                to="/create"
                className="group relative inline-flex items-center gap-3 px-8 py-4 bg-white text-black font-bold text-base rounded-full hover:bg-accent-cream transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.4)] hover:-translate-y-1 active:scale-[0.97] overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
                <Radio className="w-5 h-5 relative z-10" />
                <span className="relative z-10">Host a Room</span>
                <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/rooms"
                className="inline-flex items-center gap-3 px-8 py-4 surface text-white font-semibold text-base rounded-full hover:border-white/20 transition-all hover:-translate-y-1 active:scale-[0.97]"
              >
                <Headphones className="w-5 h-5" />
                Live Rooms
              </Link>
            </div>
          </div>

          {/* Right Visual: Creative 3D Vinyl & Orbiting Elements */}
          <div className="relative w-full h-[500px] items-center justify-center hidden lg:flex animate-fade-up" style={{ perspective: '1000px', animationDelay: '0.4s' }}>
            {/* The 3D Scene Container */}
            <div className="relative w-[360px] h-[360px] hover:scale-105 transition-transform duration-1000 ease-out" style={{ transform: 'rotateX(25deg) rotateY(-15deg) rotateZ(5deg)', transformStyle: 'preserve-3d' }}>
              
              {/* Ambient Glowing Rings */}
              <div className="absolute inset-[-60px] rounded-full border border-accent-emerald/20 shadow-[0_0_80px_rgba(16,185,129,0.3)] animate-pulse-subtle" style={{ transform: 'translateZ(-20px)' }} />
              <div className="absolute inset-[-120px] rounded-full border border-accent-cyan/15 border-dashed animate-spin-slow" style={{ animationDuration: '30s', transform: 'translateZ(-40px)' }} />

              {/* Main Vinyl Record */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#181818] to-[#050505] border-[14px] border-[#222] shadow-[20px_30px_60px_rgba(0,0,0,0.9)] animate-spin-slow flex items-center justify-center" style={{ animationDuration: '8s' }}>
                 {/* Grooves */}
                 <div className="absolute inset-4 rounded-full border border-white/5" />
                 <div className="absolute inset-10 rounded-full border border-white/5" />
                 <div className="absolute inset-16 rounded-full border border-white/5" />
                 <div className="absolute inset-24 rounded-full border border-white/5" />
                 
                 {/* Center Label */}
                 <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-accent-emerald via-accent-cyan to-blue-500 flex flex-col items-center justify-center relative overflow-hidden shadow-inner border-2 border-[#111]">
                   <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
                   {/* Center Spindle Hole */}
                   <div className="w-4 h-4 rounded-full bg-[#111] shadow-inner relative z-10 ring-4 ring-black/30" />
                   <span className="absolute bottom-5 text-[9px] font-black text-black/70 uppercase tracking-[0.3em] z-10 font-display">Modern</span>
                 </div>
              </div>

              {/* Orbiting Avatar Listeners */}
              <div className="absolute inset-[-90px] animate-spin-slow" style={{ animationDuration: '20s', animationDirection: 'reverse', transformStyle: 'preserve-3d', transform: 'translateZ(30px)' }}>
                {[
                  { pos: 'top-0 left-1/2 -ml-8', seed: 'Felix', delay: '0s', color: 'border-accent-emerald' },
                  { pos: 'bottom-0 left-1/2 -ml-8', seed: 'Aneka', delay: '-5s', color: 'border-accent-cyan' },
                  { pos: 'top-1/2 left-0 -mt-8', seed: 'Luna', delay: '-10s', color: 'border-accent-cream' },
                  { pos: 'top-1/2 right-0 -mt-8', seed: 'Oliver', delay: '-15s', color: 'border-white' }
                ].map((listener, i) => (
                  <div key={i} className={`absolute ${listener.pos} w-16 h-16 rounded-full border-4 ${listener.color} bg-bg overflow-hidden shadow-[0_10px_20px_rgba(0,0,0,0.5)] animate-spin-slow`} style={{ animationDuration: '20s' }}>
                    <img src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${listener.seed}`} className="w-full h-full object-cover" alt="Listener" />
                  </div>
                ))}
              </div>
              
              {/* Floating Music Notes escaping the record */}
              <div className="absolute -top-16 -right-8 text-accent-emerald animate-bounce" style={{ animationDuration: '2.5s', transform: 'translateZ(60px)' }}>
                <Music2 className="w-12 h-12 filter drop-shadow-[0_0_20px_rgba(16,185,129,0.8)]" />
              </div>
              <div className="absolute -bottom-8 -left-12 text-accent-cyan animate-bounce" style={{ animationDuration: '3.5s', animationDelay: '0.5s', transform: 'translateZ(40px)' }}>
                <Music2 className="w-9 h-9 filter drop-shadow-[0_0_20px_rgba(6,182,212,0.8)]" />
              </div>

            </div>
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
          <div className="md:col-span-2 surface rounded-[2.5rem] p-10 flex flex-col justify-end relative overflow-hidden group hover:border-white/20 transition-all duration-300">
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent-cyan/10 rounded-full filter blur-[80px] group-hover:bg-accent-cyan/20 transition-colors duration-500" />
            
            <div className="relative z-10 max-w-md">
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-6 backdrop-blur-md border border-white/5 shadow-inner">
                <Zap className="w-7 h-7 text-accent-cyan" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Real-Time Sync Engine</h3>
              <p className="text-text-secondary leading-relaxed text-lg">
                Experience ultra-low latency playback synchronization. When you pause, skip, or vote, the entire room moves in lockstep.
              </p>
            </div>
          </div>

          {/* Tall Bento Item */}
          <div className="md:col-span-1 md:row-span-2 surface rounded-[2.5rem] p-10 flex flex-col relative overflow-hidden group hover:border-white/20 transition-all duration-300">
            <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-accent-emerald/10 to-transparent pointer-events-none" />
            <div>
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-6 backdrop-blur-md border border-white/5 shadow-inner">
                <Music2 className="w-7 h-7 text-accent-emerald" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Audiophile Quality</h3>
              <p className="text-text-secondary leading-relaxed">
                Stream in pristine audio fidelity. Drop in tracks or pick from our curated open-source catalog without compression penalties.
              </p>
            </div>
            
            {/* Animated Equalizer Bars */}
            <div className="mt-auto flex h-24 items-end justify-center gap-1.5 rounded-2xl bg-black/40 border border-white/5 p-5 shadow-inner">
              {[40, 75, 45, 95, 60, 100, 50, 85, 40].map((h, i) => (
                <span
                  key={i}
                  style={{ height: `${h}%`, animationDelay: `${i * 90}ms` }}
                  className="w-1.5 origin-bottom rounded-full bg-accent-emerald/90 motion-safe:animate-[eq_1.2s_ease-in-out_infinite]"
                />
              ))}
            </div>
          </div>

          {/* Standard Bento Item */}
          <div className="md:col-span-1 surface rounded-[2.5rem] p-8 flex flex-col justify-center relative overflow-hidden group hover:border-white/20 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-5 backdrop-blur-md border border-white/5">
              <Globe2 className="w-6 h-6 text-accent-cream" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Global Community</h3>
            <p className="text-text-secondary leading-relaxed">
              Open your room to the world or host private listening parties with a single link.
            </p>
          </div>

          {/* Real Counter Bento Item */}
          <div className="md:col-span-1 surface rounded-[2.5rem] p-8 flex flex-col justify-center relative overflow-hidden group hover:border-white/20 transition-all duration-300 text-center items-center">
            <h3 className="text-4xl font-black text-white mb-2 tabular-nums">
              {featuredRoom ? '1+' : '0'}
            </h3>
            <p className="text-text-secondary font-medium uppercase tracking-wider text-xs">
              {featuredRoom ? 'Active Rooms Now' : 'Rooms Live · Be The First'}
            </p>
          </div>
        </div>
      </section>

      {/* Featured Room Peek */}
      {featuredRoom && (
        <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative mb-12">
          <div className="surface rounded-[3rem] overflow-hidden p-2 group">
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
                  <p className="text-text-secondary text-lg mb-8 line-clamp-2 leading-relaxed">
                    {featuredRoom.description && !featuredRoom.description.toLowerCase().includes('hello')
                      ? featuredRoom.description
                      : 'Curated soundscapes and real-time synchronized music room. Drop in and listen in lockstep.'}
                  </p>
                  
                  <Link
                    to={`/room/${featuredRoom.id}`}
                    className="inline-flex items-center gap-3 px-8 py-4 bg-white text-black font-bold rounded-full hover:bg-accent-cream transition-all hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] active:scale-[0.98]"
                  >
                    Join Room <ArrowRight className="w-5 h-5" />
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

