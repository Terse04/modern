import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, QrCode, Hash } from 'lucide-react';
import { Button } from '../components/ui/Button';
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
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-10 pb-24 md:pb-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-display uppercase">
          Join a Room
        </h1>
        <p className="text-sm text-text-secondary mt-1.5">
          Enter a room code or scan a QR code from a friend.
        </p>
      </div>

      <div className="space-y-8">
        {/* Room Code Input */}
        <div>
          <label className="flex items-center gap-2 text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">
            <Hash className="w-3.5 h-3.5" />
            Room Code
          </label>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="e.g. late-night-coding"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              className="flex-1 bg-surface-elevated border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus transition-colors font-mono tracking-wider"
            />
            <Button
              variant="primary"
              size="lg"
              onClick={handleJoin}
              isLoading={isJoining}
              disabled={!code.trim()}
              className="rounded-xl px-6"
            >
              <LogIn className="w-4 h-4" />
              Join
            </Button>
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-text-muted uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* QR Code Scanner Placeholder */}
        <div className="flex flex-col items-center justify-center p-8 bg-surface-elevated/40 border border-border/40 rounded-2xl">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-surface-hover border border-border mb-4">
            <QrCode className="w-7 h-7 text-text-muted" />
          </div>
          <h3 className="text-sm font-semibold text-text-primary mb-1">QR Code Scanner</h3>
          <p className="text-xs text-text-muted text-center max-w-xs">
            Point your camera at a room QR code to join instantly.
            Camera access is required.
          </p>

          {/* Demo QR */}
          <div className="mt-6">
            <QRCodeView
              value={`${window.location.origin}/room/late-night-coding`}
              size={140}
            />
            <p className="text-[10px] text-text-muted text-center mt-2">Demo: Late Night Coding</p>
          </div>
        </div>

        {/* Quick Join Suggestions */}
        <div>
          <h3 className="text-xs font-medium text-text-secondary mb-3 uppercase tracking-wider">
            Quick Join
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {['late-night-coding', '2000s-nostalgia', 'friday-night', 'lo-fi-study'].map((id) => (
              <button
                key={id}
                onClick={() => {
                  setCode(id);
                  navigate(`/room/${id}`);
                }}
                className="px-3 py-2.5 text-xs font-mono text-text-secondary bg-surface-elevated border border-border rounded-xl hover:border-border-focus hover:text-text-primary transition-colors text-left truncate"
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
