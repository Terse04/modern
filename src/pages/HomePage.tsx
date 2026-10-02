import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Radio,
  Headphones,
  Music,
  Music2,
  ArrowRight,
  Zap,
  Users,
  BarChart2,
  Sparkles,
} from 'lucide-react';
import { roomService } from '../services/roomService';
import { adminService } from '../services/adminService';
import { CURATED_OPEN_TRACKS } from '../services/openMusicService';
import { Room } from '../types';

export const HomePage: React.FC = () => {
  const [featuredRoom, setFeaturedRoom] = useState<Room | null>(null);
  const [totalListeners, setTotalListeners] = useState<number>(0);
  const [liveRoomsCount, setLiveRoomsCount] = useState<number>(0);
  const [totalTracksCount, setTotalTracksCount] = useState<number>(CURATED_OPEN_TRACKS.length);

  useEffect(() => {
    // Fetch live rooms & stats
    roomService.getLiveRooms().then((rooms) => {
      if (rooms && rooms.length > 0) {
        setFeaturedRoom(rooms[0]);
        setLiveRoomsCount(rooms.length);
        const listeners = rooms.reduce((acc, r) => acc + (r.listenerCount || 1), 0);
        setTotalListeners(listeners);
      }
    });

    adminService.getStats().then((stats) => {
      if (stats.totalTracks > 0) {
        setTotalTracksCount(stats.totalTracks);
      }
      if (stats.liveRooms > 0) {
        setLiveRoomsCount(stats.liveRooms);
      }
      if (stats.totalListeners > 0) {
        setTotalListeners(stats.totalListeners);
      }
    }).catch(() => {
      // Fallback gracefully to roomService values
    });
  }, []);

  return (
    <div className="relative w-full flex flex-col items-center overflow-x-hidden bg-[#07080B] text-white">
      {/* ─── Ambient Atmospheric Background Glows ──────────────────────────── */}
      <div className="absolute top-0 right-0 w-[600px] h-[500px] bg-cyan-500/[0.08] filter blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute top-[20%] left-[-100px] w-[500px] h-[450px] bg-indigo-600/[0.06] filter blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute top-[55%] right-[-50px] w-[550px] h-[450px] bg-purple-600/[0.05] filter blur-[160px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-[600px] h-[400px] bg-teal-500/[0.05] filter blur-[150px] rounded-full pointer-events-none" />

      {/* Subtle Dot Grid Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" />

      {/* ─── 1. HERO SECTION ─────────────────────────────────────────────── */}
      <section className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-20 sm:pb-28 flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-8 z-10">
        {/* Left Column: Headline, Copy, Action Buttons, Stats */}
        <div className="w-full lg:max-w-xl flex flex-col items-start text-left">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-[11px] sm:text-xs font-bold tracking-wider uppercase mb-6 sm:mb-8 shadow-[0_0_15px_rgba(20,184,166,0.15)]">
            <span className="flex items-center gap-0.5">
              <span className="w-1 h-2 rounded-full bg-teal-400 animate-pulse" />
              <span className="w-1 h-3.5 rounded-full bg-teal-400" />
              <span className="w-1 h-2 rounded-full bg-teal-400 animate-pulse" />
            </span>
            <span>The New Standard in Social Listening</span>
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shadow-[0_0_6px_#2dd4bf]" />
          </div>

          {/* Large Hero Title */}
          <h1 className="text-[clamp(2.75rem,7vw,5.5rem)] font-black tracking-[-0.03em] font-display text-white leading-[0.92] mb-6">
            LISTEN
            <br />
            <span className="bg-gradient-to-r from-[#22D3EE] via-[#38BDF8] to-[#818CF8] bg-clip-text text-transparent inline-block mt-1">
              TOGETHER.
            </span>
          </h1>

          {/* Subtitle / Description */}
          <p className="text-white/60 text-base sm:text-lg leading-relaxed font-normal max-w-lg mb-8 sm:mb-10">
            Experience the ultimate browser-first social listening platform. Create a room, invite friends, and play music in perfect sync.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-4 mb-10 sm:mb-14">
            <Link
              to="/create"
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-gradient-to-r from-teal-400 via-cyan-400 to-indigo-400 hover:from-teal-300 hover:via-cyan-300 hover:to-indigo-300 text-slate-950 font-bold text-sm shadow-[0_0_25px_rgba(6,182,212,0.35)] hover:shadow-[0_0_35px_rgba(6,182,212,0.55)] active:scale-[0.98] transition-all"
            >
              <Radio className="w-4 h-4" />
              <span>Host a Room</span>
              <ArrowRight className="w-4 h-4 ml-0.5" />
            </Link>

            <Link
              to="/rooms"
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-white font-semibold text-sm backdrop-blur-md transition-all active:scale-[0.98]"
            >
              <Headphones className="w-4 h-4 text-white/70" />
              <span>Live Rooms</span>
            </Link>
          </div>

          {/* Compact Product Metrics */}
          <div className="flex items-center gap-6 sm:gap-8 pt-2">
            <div className="border-r border-white/10 pr-6 sm:pr-8">
              <span className="text-xl sm:text-2xl font-black text-white font-display block leading-none">
                {totalListeners > 0 ? `${totalListeners}+` : '1K+'}
              </span>
              <span className="text-[11px] font-medium text-white/45 uppercase tracking-wider mt-1 block">
                Active Listeners
              </span>
            </div>

            <div className="border-r border-white/10 pr-6 sm:pr-8">
              <span className="text-xl sm:text-2xl font-black text-white font-display block leading-none">
                {liveRoomsCount > 0 ? `${liveRoomsCount}+` : '50+'}
              </span>
              <span className="text-[11px] font-medium text-white/45 uppercase tracking-wider mt-1 block">
                Rooms Created
              </span>
            </div>

            <div>
              <span className="text-xl sm:text-2xl font-black text-white font-display block leading-none">
                {totalTracksCount > 0 ? `${totalTracksCount}+` : '100+'}
              </span>
              <span className="text-[11px] font-medium text-white/45 uppercase tracking-wider mt-1 block">
                Songs Shared
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Hero Centerpiece Vinyl & Orbiting Audio Interface */}
        <div className="w-full lg:w-auto flex items-center justify-center relative py-8 sm:py-12">
          {/* Vinyl Disc Container */}
          <div className="relative w-[320px] h-[320px] sm:w-[380px] sm:h-[380px] md:w-[420px] md:h-[420px] flex items-center justify-center">
            {/* Orbital Rings */}
            <div className="absolute inset-[-40px] sm:inset-[-55px] rounded-full border border-cyan-500/25 shadow-[0_0_50px_rgba(6,182,212,0.12)] pointer-events-none" />
            <div
              className="absolute inset-[-75px] sm:inset-[-95px] rounded-full border border-dashed border-indigo-400/20 pointer-events-none animate-spin-slow"
              style={{ animationDuration: '45s' }}
            />

            {/* Main Vinyl Record */}
            <div className="relative w-full h-full rounded-full bg-[#0a0c10] border-[10px] sm:border-[12px] border-[#141820] shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_40px_rgba(6,182,212,0.12)] flex items-center justify-center overflow-hidden">
              {/* Conic Sheen Reflection */}
              <div
                className="absolute inset-0 rounded-full opacity-20 pointer-events-none"
                style={{
                  background:
                    'conic-gradient(from 45deg, rgba(255,255,255,0.25) 0deg, transparent 60deg, rgba(255,255,255,0.2) 120deg, transparent 180deg, rgba(255,255,255,0.25) 240deg, transparent 300deg, rgba(255,255,255,0.2) 360deg)',
                }}
              />

              {/* Concentric Grooves */}
              <div className="absolute inset-3 sm:inset-4 rounded-full border border-white/[0.04]" />
              <div className="absolute inset-7 sm:inset-9 rounded-full border border-white/[0.04]" />
              <div className="absolute inset-11 sm:inset-14 rounded-full border border-white/[0.04]" />
              <div className="absolute inset-15 sm:inset-19 rounded-full border border-white/[0.04]" />
              <div className="absolute inset-20 sm:inset-24 rounded-full border border-white/[0.04]" />
              <div className="absolute inset-24 sm:inset-29 rounded-full border border-white/[0.04]" />

              {/* Center Disc Label */}
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-[#07090E] border-2 border-cyan-400/50 shadow-[0_0_25px_rgba(6,182,212,0.35)] flex flex-col items-center justify-center">
                {/* Soundwave Bars in Center */}
                <div className="flex items-center gap-1 mb-1">
                  <span className="w-1 h-3 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="w-1 h-5 rounded-full bg-cyan-400" />
                  <span className="w-1 h-7 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                  <span className="w-1 h-5 rounded-full bg-cyan-400" />
                  <span className="w-1 h-3 rounded-full bg-cyan-400 animate-pulse" />
                </div>
                <span className="text-[10px] font-bold text-white uppercase tracking-widest font-display">
                  Modern
                </span>
                {/* Spindle hole */}
                <div className="absolute w-3.5 h-3.5 rounded-full bg-[#12151D] border border-white/20 shadow-inner" />
              </div>
            </div>

            {/* Tonearm Stylus */}
            <div className="absolute -top-6 -right-6 sm:-top-8 sm:-right-8 w-32 h-44 sm:w-36 sm:h-48 pointer-events-none select-none z-20">
              <svg
                className="w-full h-full drop-shadow-[0_10px_15px_rgba(0,0,0,0.8)]"
                viewBox="0 0 140 190"
                fill="none"
              >
                {/* Pivot Base */}
                <circle
                  cx="110"
                  cy="30"
                  r="16"
                  fill="#181D28"
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth="1.5"
                />
                <circle cx="110" cy="30" r="8" fill="#242B3B" />
                {/* Arm Rod */}
                <path
                  d="M106 38 L48 135 L32 155"
                  stroke="#3A4459"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <path
                  d="M106 38 L48 135 L32 155"
                  stroke="#607090"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                {/* Cartridge Head */}
                <rect
                  x="22"
                  y="152"
                  width="16"
                  height="22"
                  rx="3"
                  transform="rotate(-35 30 163)"
                  fill="#121620"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="1"
                />
                {/* Stylus Tip with Cyan LED Glow */}
                <circle
                  cx="21"
                  cy="177"
                  r="2.5"
                  fill="#22D3EE"
                  filter="drop-shadow(0 0 6px #22D3EE)"
                />
              </svg>
            </div>

            {/* Orbiting User Avatars with Glowing Rings */}
            {/* Top Avatar */}
            <div className="absolute -top-4 sm:-top-6 left-1/3 w-12 h-12 sm:w-14 sm:h-14 rounded-full ring-2 ring-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.6)] overflow-hidden bg-[#0A0D14] motion-safe:animate-[float-slow]">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
                alt="Listener"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Top-Right Avatar */}
            <div
              className="absolute top-1/4 -right-4 sm:-right-7 w-11 h-11 sm:w-13 sm:h-13 rounded-full ring-2 ring-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.5)] overflow-hidden bg-[#0A0D14] motion-safe:animate-[float-slow]"
              style={{ animationDelay: '1.5s' }}
            >
              <img
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80"
                alt="Listener"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Bottom-Right Avatar */}
            <div
              className="absolute bottom-5 -right-3 sm:-right-5 w-11 h-11 sm:w-12 sm:h-12 rounded-full ring-2 ring-teal-400 shadow-[0_0_15px_rgba(20,184,166,0.5)] overflow-hidden bg-[#0A0D14] motion-safe:animate-[float-slow]"
              style={{ animationDelay: '3s' }}
            >
              <img
                src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80"
                alt="Listener"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Bottom Avatar */}
            <div
              className="absolute -bottom-5 sm:-bottom-7 left-1/4 w-12 h-12 sm:w-14 sm:h-14 rounded-full ring-2 ring-indigo-400 shadow-[0_0_20px_rgba(129,140,248,0.5)] overflow-hidden bg-[#0A0D14] motion-safe:animate-[float-slow]"
              style={{ animationDelay: '2s' }}
            >
              <img
                src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80"
                alt="Listener"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Floating Neon Music Notes */}
            <div
              className="absolute -top-10 right-1/4 text-cyan-400 motion-safe:animate-bounce pointer-events-none"
              style={{ animationDuration: '3s' }}
            >
              <Music className="w-8 h-8 filter drop-shadow-[0_0_12px_rgba(6,182,212,0.8)]" />
            </div>
            <div
              className="absolute bottom-1/4 -left-8 text-cyan-300 motion-safe:animate-bounce pointer-events-none"
              style={{ animationDuration: '4s', animationDelay: '1s' }}
            >
              <Music2 className="w-7 h-7 filter drop-shadow-[0_0_12px_rgba(6,182,212,0.8)]" />
            </div>

            {/* Floating Glass Card: Listening Together */}
            <div className="absolute -bottom-6 -right-3 sm:-bottom-4 sm:-right-8 bg-[#0B0E17]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-3 sm:p-3.5 shadow-2xl flex items-center gap-3 z-30">
              {/* Equalizer Bars */}
              <div className="flex items-end gap-1 h-5 px-0.5">
                <span className="w-1 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="w-1 h-4 rounded-full bg-cyan-400" />
                <span className="w-1 h-5 rounded-full bg-teal-300 shadow-[0_0_8px_rgba(45,212,191,0.8)]" />
                <span className="w-1 h-3 rounded-full bg-cyan-400" />
              </div>

              <div>
                <span className="text-[11px] font-semibold text-white/90 block leading-tight mb-1">
                  Listening Together
                </span>
                <div className="flex items-center gap-1.5">
                  <div className="flex -space-x-1.5 overflow-hidden">
                    <img
                      className="inline-block w-5 h-5 rounded-full ring-1 ring-black object-cover"
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80"
                      alt=""
                    />
                    <img
                      className="inline-block w-5 h-5 rounded-full ring-1 ring-black object-cover"
                      src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80"
                      alt=""
                    />
                    <img
                      className="inline-block w-5 h-5 rounded-full ring-1 ring-black object-cover"
                      src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=80&q=80"
                      alt=""
                    />
                  </div>
                  <span className="text-[9px] font-bold text-white/70 bg-white/10 px-1.5 py-0.5 rounded-full border border-white/10">
                    +{totalListeners > 0 ? totalListeners : '12'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 2. WHY MODERN / CRAFTED FOR EXCELLENCE ────────────────────── */}
      <section className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 z-10">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16 space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-bold uppercase tracking-wider shadow-[0_0_12px_rgba(20,184,166,0.15)]">
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span>Why Modern</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white font-display tracking-tight">
            Crafted for{' '}
            <span className="bg-gradient-to-r from-teal-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
              Excellence
            </span>
          </h2>

          <p className="text-white/60 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Discover a feature set designed to elevate your shared audio experiences to new heights.
          </p>
        </div>

        {/* 2x2 Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {/* Card 1: Real-Time Sync Engine */}
          <div className="bg-[#0B0D13]/75 hover:bg-[#0E111A]/85 border border-white/[0.07] hover:border-cyan-500/30 rounded-2xl md:rounded-[22px] p-7 sm:p-8 transition-all duration-300 relative overflow-hidden group shadow-lg flex flex-col justify-between min-h-[290px]">
            <div>
              {/* Header: Icon & Badge */}
              <div className="flex items-center justify-between mb-5">
                <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-300 shadow-[0_0_15px_rgba(20,184,166,0.2)]">
                  <Zap className="w-5 h-5 text-teal-400" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-400 text-xs font-mono font-semibold">
                  &lt; 50ms
                </span>
              </div>

              <h3 className="text-xl font-bold text-white mb-2.5 font-display tracking-tight">
                Real-Time Sync Engine
              </h3>
              <p className="text-white/60 text-sm leading-relaxed max-w-md">
                Experience ultra-low latency playback synchronization. When you pause, skip, or vote, the entire room moves in lockstep.
              </p>
            </div>

            {/* Visual: Glowing Frequency Waveform */}
            <div className="mt-6 pt-2 w-full h-16 relative overflow-hidden">
              <svg className="w-full h-full opacity-70 group-hover:opacity-100 transition-opacity" viewBox="0 0 400 70" fill="none">
                <path
                  d="M0 60 C 50 60, 90 20, 140 45 C 190 70, 240 10, 300 40 C 350 65, 380 30, 400 35"
                  stroke="url(#syncGrad)"
                  strokeWidth="2.5"
                  fill="none"
                />
                <path
                  d="M0 60 C 50 60, 90 20, 140 45 C 190 70, 240 10, 300 40 C 350 65, 380 30, 400 35 L 400 70 L 0 70 Z"
                  fill="url(#syncFill)"
                  opacity="0.25"
                />
                <defs>
                  <linearGradient id="syncGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#2DD4BF" />
                    <stop offset="60%" stopColor="#06B6D4" />
                    <stop offset="100%" stopColor="#818CF8" />
                  </linearGradient>
                  <linearGradient id="syncFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06B6D4" />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          {/* Card 2: Audiophile Quality */}
          <div className="bg-[#0B0D13]/75 hover:bg-[#0E111A]/85 border border-white/[0.07] hover:border-cyan-500/30 rounded-2xl md:rounded-[22px] p-7 sm:p-8 transition-all duration-300 relative overflow-hidden group shadow-lg flex flex-col justify-between min-h-[290px]">
            <div>
              <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-300 shadow-[0_0_15px_rgba(20,184,166,0.2)] mb-5">
                <Music2 className="w-5 h-5 text-teal-400" />
              </div>

              <h3 className="text-xl font-bold text-white mb-2.5 font-display tracking-tight">
                Audiophile Quality
              </h3>
              <p className="text-white/60 text-sm leading-relaxed max-w-sm">
                Stream in pristine audio fidelity. Drop in tracks or pick from our curated open-source catalog without compression penalties.
              </p>
            </div>

            {/* Visual: Layered 3D Album Artwork Cards */}
            <div className="mt-4 flex items-end justify-end relative h-20 pr-4">
              <div className="absolute right-14 bottom-2 w-16 h-16 rounded-xl overflow-hidden border border-white/15 opacity-40 transform -rotate-12 group-hover:-translate-x-2 transition-transform duration-300 shadow-lg">
                <img
                  src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=200&q=80"
                  alt="Artwork 1"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute right-7 bottom-1 w-18 h-18 rounded-xl overflow-hidden border border-white/20 opacity-70 transform -rotate-6 group-hover:-translate-x-1 transition-transform duration-300 shadow-xl">
                <img
                  src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=200&q=80"
                  alt="Artwork 2"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-cyan-400/50 shadow-[0_0_20px_rgba(6,182,212,0.4)] group-hover:scale-105 transition-transform duration-300">
                <img
                  src="https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=200&q=80"
                  alt="Artwork 3"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-1 left-2 right-2 flex items-center gap-0.5">
                  <span className="w-1 h-2 rounded-full bg-cyan-400" />
                  <span className="w-1 h-3 rounded-full bg-cyan-300" />
                  <span className="w-1 h-1.5 rounded-full bg-cyan-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Global Community */}
          <div className="bg-[#0B0D13]/75 hover:bg-[#0E111A]/85 border border-white/[0.07] hover:border-cyan-500/30 rounded-2xl md:rounded-[22px] p-7 sm:p-8 transition-all duration-300 relative overflow-hidden group shadow-lg flex flex-col justify-between min-h-[290px]">
            {/* World Map Dotted Graphic in Background */}
            <div className="absolute top-4 right-4 w-52 h-44 opacity-25 group-hover:opacity-40 transition-opacity pointer-events-none">
              <svg viewBox="0 0 200 120" className="w-full h-full">
                {/* Dotted Connection Grid */}
                <circle cx="45" cy="40" r="2.5" fill="#06B6D4" />
                <circle cx="85" cy="35" r="2.5" fill="#2DD4BF" />
                <circle cx="140" cy="50" r="2.5" fill="#818CF8" />
                <circle cx="165" cy="75" r="2" fill="#06B6D4" />
                <circle cx="70" cy="80" r="2" fill="#2DD4BF" />
                <path d="M45 40 Q 65 20, 85 35" stroke="#06B6D4" strokeWidth="1" strokeDasharray="2 2" fill="none" />
                <path d="M85 35 Q 115 25, 140 50" stroke="#818CF8" strokeWidth="1" strokeDasharray="2 2" fill="none" />
                <path d="M140 50 Q 155 60, 165 75" stroke="#06B6D4" strokeWidth="1" strokeDasharray="2 2" fill="none" />
                <path d="M85 35 Q 75 60, 70 80" stroke="#2DD4BF" strokeWidth="1" strokeDasharray="2 2" fill="none" />
              </svg>
            </div>

            <div className="relative z-10">
              <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-300 shadow-[0_0_15px_rgba(20,184,166,0.2)] mb-5">
                <Users className="w-5 h-5 text-teal-400" />
              </div>

              <h3 className="text-xl font-bold text-white mb-2.5 font-display tracking-tight">
                Global Community
              </h3>
              <p className="text-white/60 text-sm leading-relaxed max-w-sm">
                Open your room to the world or host private listening parties with a single link.
              </p>
            </div>

            {/* Bottom Avatar Row */}
            <div className="flex items-center gap-2 pt-4 relative z-10">
              <div className="flex -space-x-2">
                <img
                  className="w-7 h-7 rounded-full ring-2 ring-[#0B0D13] object-cover"
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
                  alt=""
                />
                <img
                  className="w-7 h-7 rounded-full ring-2 ring-[#0B0D13] object-cover"
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80"
                  alt=""
                />
                <img
                  className="w-7 h-7 rounded-full ring-2 ring-[#0B0D13] object-cover"
                  src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&q=80"
                  alt=""
                />
              </div>
              <span className="text-[10px] font-bold text-white/70 bg-white/10 px-2 py-0.5 rounded-full border border-white/10">
                +1K
              </span>
            </div>
          </div>

          {/* Card 4: Always Growing */}
          <div className="bg-[#0B0D13]/75 hover:bg-[#0E111A]/85 border border-white/[0.07] hover:border-cyan-500/30 rounded-2xl md:rounded-[22px] p-7 sm:p-8 transition-all duration-300 relative overflow-hidden group shadow-lg flex flex-col justify-between min-h-[290px]">
            <div>
              {/* Header: Icon & Badge */}
              <div className="flex items-center justify-between mb-5">
                <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-300 shadow-[0_0_15px_rgba(20,184,166,0.2)]">
                  <BarChart2 className="w-5 h-5 text-teal-400" />
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-white block leading-none">
                    {liveRoomsCount > 0 ? `${liveRoomsCount}+` : '1+'}
                  </span>
                  <span className="text-[9px] font-bold text-white/45 uppercase tracking-wider">
                    Active Rooms Now
                  </span>
                </div>
              </div>

              <h3 className="text-xl font-bold text-white mb-2.5 font-display tracking-tight">
                Always Growing
              </h3>
              <p className="text-white/60 text-sm leading-relaxed max-w-sm">
                New features, better discovery, and a passionate community making Modern bigger every day.
              </p>
            </div>

            {/* Visual: Dynamic Animated Equalizer Bars */}
            <div className="mt-4 flex items-end justify-end gap-1.5 h-14 pr-2">
              {[35, 65, 45, 90, 60, 100, 50, 85, 40, 75, 50].map((h, i) => (
                <span
                  key={i}
                  style={{
                    height: `${h}%`,
                    animationDelay: `${i * 110}ms`,
                  }}
                  className="w-1.5 origin-bottom rounded-full bg-gradient-to-t from-teal-500 to-cyan-400 motion-safe:animate-[eq_1.2s_ease-in-out_infinite] shadow-[0_0_8px_rgba(6,182,212,0.4)]"
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── 3. FEATURED ROOM: LATE NIGHT CODING ──────────────────────────── */}
      <section className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 sm:pb-28 z-10">
        <div className="w-full rounded-[24px] sm:rounded-[32px] overflow-hidden border border-white/[0.08] bg-[#0A0C13] relative group shadow-2xl min-h-[360px] sm:min-h-[400px] flex flex-col md:flex-row justify-between">
          {/* Left Room Info */}
          <div className="p-8 sm:p-12 md:p-14 flex-1 flex flex-col justify-between z-20">
            <div>
              {/* Live and Featured Badges */}
              <div className="flex items-center gap-3 mb-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Live</span>
                </span>
                <span className="text-xs font-bold tracking-widest text-cyan-400 uppercase">
                  Now Featured
                </span>
              </div>

              {/* Room Title */}
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white font-display tracking-tight mb-4">
                {featuredRoom?.name || 'Late Night Coding'}
              </h2>

              {/* Room Description */}
              <p className="text-white/60 text-base sm:text-lg leading-relaxed max-w-xl mb-8">
                {featuredRoom?.description && !featuredRoom.description.toLowerCase().includes('hello')
                  ? featuredRoom.description
                  : 'Curated soundscapes and real-time synchronized music room. Drop in and listen in lockstep.'}
              </p>

              {/* Join Action Button */}
              <Link
                to={featuredRoom ? `/room/${featuredRoom.id}` : '/rooms'}
                className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full bg-white hover:bg-slate-200 text-slate-950 font-bold text-sm shadow-[0_0_30px_rgba(255,255,255,0.25)] active:scale-[0.98] transition-all"
              >
                <span>Join Room</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Listeners Count & Stack */}
            <div className="flex items-center gap-3 pt-8 sm:pt-10">
              <div className="flex -space-x-2">
                <img
                  className="w-7 h-7 rounded-full ring-2 ring-[#0A0C13] object-cover"
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
                  alt=""
                />
                <img
                  className="w-7 h-7 rounded-full ring-2 ring-[#0A0C13] object-cover"
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80"
                  alt=""
                />
                <img
                  className="w-7 h-7 rounded-full ring-2 ring-[#0A0C13] object-cover"
                  src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&q=80"
                  alt=""
                />
                <img
                  className="w-7 h-7 rounded-full ring-2 ring-[#0A0C13] object-cover"
                  src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=100&q=80"
                  alt=""
                />
              </div>
              <span className="text-xs font-semibold text-white/70">
                {featuredRoom?.listenerCount || 24} people listening
              </span>
            </div>
          </div>

          {/* Right Immersive Atmosphere Graphic */}
          <div className="w-full md:w-[48%] relative min-h-[260px] md:min-h-full overflow-hidden">
            {/* Ambient Night Scene Photo */}
            <img
              src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80"
              alt="Late Night Coding Atmosphere"
              className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-luminosity scale-105 group-hover:scale-100 transition-transform duration-700"
            />
            {/* Smooth Edge Gradients */}
            <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#0A0C13] via-[#0A0C13]/50 to-transparent" />
            <div className="absolute inset-0 bg-indigo-950/20 mix-blend-color" />

            {/* Floating Now Playing Audio Card */}
            <div className="absolute bottom-6 right-6 sm:bottom-8 sm:right-8 bg-[#0B0E18]/85 backdrop-blur-md border border-white/10 rounded-2xl p-3 px-4 shadow-2xl flex items-center gap-3.5 z-20">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-black/50 border border-white/10 shrink-0">
                <img
                  src={
                    featuredRoom?.artwork ||
                    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=200&q=80'
                  }
                  alt="Track Art"
                  className="w-full h-full object-cover"
                />
              </div>

              <div>
                <span className="text-xs font-bold text-white block leading-tight">
                  {featuredRoom?.currentTrack?.title || 'Lo-fi Essentials'}
                </span>
                <span className="text-[11px] text-white/50 block">
                  {featuredRoom?.currentTrack?.artist
                    ? `by ${featuredRoom.currentTrack.artist}`
                    : 'by Alex'}
                </span>
              </div>

              {/* Animated Mini Equalizer */}
              <div className="flex items-end gap-1 h-4 pl-2">
                <span className="w-0.5 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="w-0.5 h-4 rounded-full bg-cyan-400" />
                <span className="w-0.5 h-3 rounded-full bg-teal-300" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Minimal Bottom Footer ───────────────────────────────────────── */}
      <footer className="w-full border-t border-white/[0.06] py-10 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-400/80" />
            <span className="font-semibold text-white/70">Modern</span>
            <span>— The new standard in social listening</span>
          </div>

          <div className="flex items-center gap-6">
            <Link to="/rooms" className="hover:text-white transition-colors">
              Explore Rooms
            </Link>
            <Link to="/create" className="hover:text-white transition-colors">
              Host a Room
            </Link>
            <Link to="/join" className="hover:text-white transition-colors">
              Join
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
