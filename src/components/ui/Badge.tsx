import React from 'react';

export interface LiveBadgeProps {
  className?: string;
  size?: 'sm' | 'md';
}

export const LiveBadge: React.FC<LiveBadgeProps> = ({ className = '', size = 'md' }) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium tracking-wide uppercase bg-black/60 backdrop-blur-md border border-white/10 text-white rounded-full ${
        size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
      } ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse" />
      LIVE
    </span>
  );
};

export interface SyncedBadgeProps {
  driftMs?: number;
  className?: string;
}

export const SyncedBadge: React.FC<SyncedBadgeProps> = ({ driftMs = 0, className = '' }) => {
  const isHealthy = Math.abs(driftMs) < 120;
  return (
    <div
      title={`Sync drift: ${driftMs}ms`}
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wider uppercase px-2.5 py-1 rounded-full border transition-colors ${
        isHealthy
          ? 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20'
          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      } ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isHealthy ? 'bg-accent-emerald' : 'bg-amber-400'
        }`}
      />
      <span>{isHealthy ? 'SYNCED ✓' : 'SYNCING...'}</span>
    </div>
  );
};
