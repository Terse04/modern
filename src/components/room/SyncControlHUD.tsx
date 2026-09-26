import React, { useState } from 'react';
import { Headphones, Crown, Zap } from 'lucide-react';
import { usePlaybackStore } from '../../stores/usePlaybackStore';
import { useToastStore } from '../ui/Toast';

interface SyncControlHUDProps {
  hostName: string;
  isHostUser: boolean;
  className?: string;
}

export const SyncControlHUD: React.FC<SyncControlHUDProps> = ({
  hostName,
  isHostUser,
  className = '',
}) => {
  const addToast = useToastStore((s) => s.addToast);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isResyncing, setIsResyncing] = useState(false);

  const { driftMetrics, resyncNow, isSoloMode, toggleSoloMode } = usePlaybackStore();

  const handleManualResync = () => {
    setIsResyncing(true);
    resyncNow();
    addToast('Realigned audio to host stream', 'info');
    setTimeout(() => setIsResyncing(false), 600);
  };

  const getStatusColor = () => {
    if (isSoloMode) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    if (driftMetrics.status === 'synced') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (driftMetrics.status === 'correcting') return 'text-sky-400 bg-sky-500/10 border-sky-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  const getStatusLabel = () => {
    if (isHostUser) return 'Master DJ • Broadcasting';
    if (isSoloMode) return 'Solo Mode (Detached)';
    if (driftMetrics.status === 'synced') return `Synced (${Math.abs(driftMetrics.driftMs)}ms)`;
    if (driftMetrics.status === 'correcting') return `Nudging (${driftMetrics.driftMs > 0 ? '+' : ''}${driftMetrics.driftMs}ms)`;
    return `Desynced (${(driftMetrics.driftMs / 1000).toFixed(1)}s)`;
  };

  return (
    <div className={`relative flex items-center gap-2 ${className}`}>
      {/* Sync Status Badge */}
      <div
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all shadow-sm ${getStatusColor()}`}
      >
        {isHostUser ? (
          <Crown className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
        ) : (
          <div className="relative flex items-center justify-center">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                driftMetrics.status === 'synced'
                  ? 'bg-emerald-400 animate-ping'
                  : driftMetrics.status === 'correcting'
                  ? 'bg-sky-400 animate-pulse'
                  : 'bg-rose-400 animate-ping'
              }`}
            />
            <span
              className={`absolute w-1.5 h-1.5 rounded-full ${
                driftMetrics.status === 'synced'
                  ? 'bg-emerald-400'
                  : driftMetrics.status === 'correcting'
                  ? 'bg-sky-400'
                  : 'bg-rose-400'
              }`}
            />
          </div>
        )}
        <span>{getStatusLabel()}</span>
      </div>

      {/* Listener Actions: Resync & Solo Mode Toggle */}
      {!isHostUser && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleManualResync}
            disabled={isResyncing || isSoloMode}
            title="Snap immediately to host's playback time"
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-elevated/60 hover:bg-surface-elevated border border-border/60 hover:border-violet-500/50 text-[11px] text-zinc-300 hover:text-white transition disabled:opacity-30 disabled:pointer-events-none"
          >
            <Zap className={`w-3 h-3 text-amber-400 ${isResyncing ? 'animate-bounce' : ''}`} />
            <span className="hidden sm:inline">Sync Now</span>
          </button>

          <button
            type="button"
            onClick={toggleSoloMode}
            title={isSoloMode ? 'Re-attach to room live broadcast' : 'Listen privately without room sync'}
            className={`p-1 rounded-lg border transition text-xs ${
              isSoloMode
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-surface-elevated/40 border-border/50 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Headphones className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Floating Info Tooltip */}
      {showTooltip && (
        <div className="absolute top-full left-0 mt-2 z-50 w-64 p-3 rounded-xl bg-zinc-950/95 border border-zinc-800 backdrop-blur-md shadow-2xl text-[11px] space-y-1.5 animate-in fade-in zoom-in-95 pointer-events-none">
          <div className="flex items-center justify-between font-semibold text-zinc-100">
            <span>Synchronized Audio Engine</span>
            <span className="text-[10px] text-zinc-500">v2.1</span>
          </div>
          <p className="text-zinc-400 leading-relaxed">
            {isHostUser
              ? 'You are the room host. Your audio playback time, pauses, and seeks are synchronized to all listeners in real-time with continuous heartbeat pulse.'
              : `Synchronized to DJ @${hostName}. Audio drift is automatically corrected using smooth rate micro-adjustments with zero audio clipping.`}
          </p>
          <div className="pt-1 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-500">
            <span>Calculated Latency: {driftMetrics.latencyMs}ms</span>
            <span className="text-emerald-400">Drift Compensation: Active</span>
          </div>
        </div>
      )}
    </div>
  );
};
