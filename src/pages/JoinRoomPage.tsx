import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, Hash, ScanLine, ArrowRight } from 'lucide-react';
import { useToastStore } from '../components/ui/Toast';
import { roomService } from '../services/roomService';
import { Room } from '../types';

export const JoinRoomPage: React.FC = () => {
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);
  const [code, setCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [liveRooms, setLiveRooms] = useState<Room[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    roomService.getLiveRooms().then((rooms) => {
      setLiveRooms(rooms.slice(0, 4));
    });
  }, []);

  const normalize = (v: string) => {
    try {
      v = new URL(v).pathname.split('/').pop() || v;
    } catch {
      // not a url
    }
    return v.replace(/^#+/, '').trim().toLowerCase().replace(/\s+/g, '-');
  };

  const handleJoin = async (targetCode?: string) => {
    const raw = targetCode || code;
    const roomId = normalize(raw);
    if (!roomId) {
      addToast('Please enter a room code', 'error');
      return;
    }

    setIsJoining(true);
    try {
      const room = await roomService.getRoomById(roomId);
      if (room) {
        addToast(`Joining "${room.name}"...`, 'success');
        navigate(`/room/${room.id}`);
      } else {
        addToast('Room not found — check your code', 'error');
      }
    } catch (err) {
      console.error('[JoinRoom] Error:', err);
      addToast('Failed to join room', 'error');
    } finally {
      setIsJoining(false);
    }
  };

  const canScan = typeof window !== 'undefined' &&
    window.matchMedia('(pointer: coarse)').matches &&
    !!navigator.mediaDevices?.getUserMedia;

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-12 pb-24 md:pb-12 relative">
      {/* Ambient background element */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-accent-emerald/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="mb-8 text-center relative z-10">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-gradient-premium font-display">
          Join a Room
        </h1>
        <p className="text-sm md:text-base text-text-secondary mt-3">
          Enter a room code or choose a live session to drop into.
        </p>
      </div>

      <div className="relative surface rounded-[2rem] p-6 md:p-10 space-y-8 overflow-hidden">
        {/* Animated Shimmer Top Border */}
        <div className="absolute top-0 left-0 right-0 h-[1px] border-shimmer" />

        {/* 1. Room Code Input (First) */}
        <div>
          <label className="flex items-center justify-center gap-2 text-xs font-bold text-text-secondary mb-3 uppercase tracking-widest">
            <Hash className="w-4 h-4 text-accent-cream" />
            Room Code or URL
          </label>
          <div className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="e.g. late-night-coding"
              value={code}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setCode(normalize(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              className="h-14 w-full truncate rounded-2xl bg-black/40 border border-white/10 px-5 font-mono text-base tracking-normal placeholder:tracking-normal placeholder:text-white/35 text-center text-text-primary focus:outline-none focus:border-accent-cream/50 focus:ring-1 focus:ring-accent-cream/30 transition-all shadow-inner"
            />
            <button
              onClick={() => handleJoin()}
              disabled={!code.trim() || isJoining}
              className="h-14 w-full py-4 rounded-2xl font-bold text-base tracking-wider bg-accent-cream text-black flex items-center justify-center gap-3 transition-all duration-300 shadow-[0_0_20px_rgba(234,229,219,0.25)] hover:shadow-[0_0_30px_rgba(234,229,219,0.4)] hover:bg-white active:scale-[0.98] btn-glow disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-white/40 disabled:shadow-none"
            >
              {isJoining ? (
                <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-black" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  JOIN ROOM
                </>
              )}
            </button>
          </div>
        </div>

        {/* 2. Quick Join Suggestions (Second) */}
        <div>
          <h3 className="text-[11px] text-center font-bold text-text-secondary mb-3 uppercase tracking-widest">
            Live Quick Join
          </h3>
          {liveRooms.length > 0 ? (
            <div className="grid grid-cols-2 gap-2.5">
              {liveRooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => {
                    setCode(room.id);
                    handleJoin(room.id);
                  }}
                  className="px-3.5 py-3 rounded-xl bg-white/[0.04] border border-white/5 font-mono text-xs text-white/80 hover:bg-white/[0.08] hover:text-white hover:border-white/20 transition-all text-center truncate shadow-inner flex items-center justify-between"
                >
                  <span className="truncate">#{room.id}</span>
                  <span className="text-[10px] text-accent-emerald ml-1.5 font-sans font-semibold">Live</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-3 px-4 rounded-xl bg-white/[0.02] border border-white/5">
              <p className="text-xs text-white/50">
                No public rooms live right now.{' '}
                <Link to="/create" className="text-accent-cyan hover:underline font-semibold ml-1">
                  Host one →
                </Link>
              </p>
            </div>
          )}
        </div>

        {/* 3. Camera Scanner (Shown on mobile devices with camera access) */}
        {canScan && (
          <div className="pt-2 border-t border-white/5">
            <button
              onClick={() => {
                setIsScanning(!isScanning);
                addToast('QR Camera scanning activated', 'info');
              }}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 text-xs font-semibold text-white/80 hover:bg-white/[0.08] hover:text-white transition-all"
            >
              <ScanLine className="w-4 h-4 text-accent-emerald" />
              <span>{isScanning ? 'Close Camera Scanner' : 'Scan a Room QR Code'}</span>
            </button>
            {isScanning && (
              <div className="mt-4 p-4 rounded-2xl bg-black/40 border border-accent-emerald/30 text-center animate-in fade-in">
                <p className="text-xs text-text-muted mb-2">Align the room QR code within the frame</p>
                <div className="w-48 h-48 mx-auto rounded-xl border-2 border-dashed border-accent-emerald/50 flex items-center justify-center text-accent-emerald text-xs animate-pulse">
                  Scanning active...
                </div>
              </div>
            )}
          </div>
        )}

        <div className="text-center pt-2">
          <Link
            to="/rooms"
            className="text-xs text-text-muted hover:text-text-primary transition-colors inline-flex items-center gap-1"
          >
            <span>Browse all live listening rooms</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
};

