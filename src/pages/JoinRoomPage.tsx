import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, QrCode, Hash } from 'lucide-react';
import { useToastStore } from '../components/ui/Toast';
import { roomService } from '../services/roomService';
import { QRCodeView } from '../components/ui/QRCodeView';

export const JoinRoomPage: React.FC = () => {
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);
  const [code, setCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async () => {
    const raw = code.trim().toLowerCase().replace(/^#+/, '');
    const roomId = raw.replace(/\s+/g, '-');
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

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-12 pb-24 md:pb-12 relative">
      {/* Ambient background element */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-accent-emerald/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="mb-10 text-center relative z-10">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-gradient-premium font-display">
          Join a Room
        </h1>
        <p className="text-sm md:text-base text-text-secondary mt-3">
          Enter a room code or scan a QR code from a friend.
        </p>
      </div>

      <div className="relative glass-premium rounded-[2rem] p-8 md:p-10 space-y-10 overflow-hidden">
        {/* Animated Shimmer Top Border */}
        <div className="absolute top-0 left-0 right-0 h-[1px] border-shimmer" />

        {/* Room Code Input */}
        <div>
          <label className="flex items-center justify-center gap-2 text-sm font-bold text-text-secondary mb-4 uppercase tracking-widest">
            <Hash className="w-4 h-4" />
            Room Code
          </label>
          <div className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="e.g. late-night-coding"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-5 text-xl md:text-2xl text-center text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cream/50 focus:ring-1 focus:ring-accent-cream/30 transition-all font-mono tracking-widest shadow-inner"
            />
            <button
              onClick={handleJoin}
              disabled={!code.trim() || isJoining}
              className="w-full py-4 rounded-2xl font-bold text-lg tracking-widest bg-accent-cream text-black flex items-center justify-center gap-3 transition-all duration-300 shadow-[0_0_20px_rgba(234,229,219,0.3)] hover:shadow-[0_0_30px_rgba(234,229,219,0.5)] hover:bg-white hover:scale-[1.02] btn-glow disabled:opacity-50 disabled:pointer-events-none"
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

        {/* Divider */}
        <div className="flex items-center gap-6">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* QR Code Scanner Placeholder */}
        <div className="flex flex-col items-center justify-center p-8 bg-black/30 border border-white/5 rounded-3xl relative group overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 border border-white/10 mb-5 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
              <QrCode className="w-7 h-7 text-text-secondary" />
            </div>
            <h3 className="text-base font-bold text-text-primary mb-2">QR Code Scanner</h3>
            <p className="text-xs text-text-muted text-center max-w-xs leading-relaxed">
              Point your camera at a room QR code to join instantly.
              Camera access is required.
            </p>

            {/* Demo QR */}
            <div className="mt-8 p-4 bg-white rounded-2xl shadow-[0_0_20px_rgba(255,255,255,0.2)]">
              <QRCodeView
                value={`${window.location.origin}/room/late-night-coding`}
                size={140}
              />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted text-center mt-4">Demo: Late Night Coding</p>
          </div>
        </div>

        {/* Quick Join Suggestions */}
        <div>
          <h3 className="text-[11px] text-center font-bold text-text-secondary mb-4 uppercase tracking-widest">
            Quick Join
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {['late-night-coding', '2000s-nostalgia', 'friday-night', 'lo-fi-study'].map((id) => (
              <button
                key={id}
                onClick={() => {
                  setCode(id);
                  navigate(`/room/${id}`);
                }}
                className="px-4 py-3 text-xs font-mono font-bold text-text-secondary bg-black/40 border border-white/5 rounded-2xl hover:border-white/20 hover:text-white transition-all text-center truncate hover:bg-black/60 shadow-inner"
              >
                #{id}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
