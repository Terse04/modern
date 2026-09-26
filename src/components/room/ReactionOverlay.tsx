import React from 'react';
import { FloatingReaction } from '../../types';

export interface ReactionOverlayProps {
  reactions: FloatingReaction[];
}

export const ReactionOverlay: React.FC<ReactionOverlayProps> = ({ reactions }) => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
      {reactions.map((r) => (
        <div
          key={r.id}
          className="absolute bottom-24 flex items-center gap-1.5 animate-fade-up transition-transform duration-1000"
          style={{
            left: `${r.x}%`,
            animationDuration: '2.5s',
          }}
        >
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-elevated/90 border border-border/80 shadow-2xl backdrop-blur-md">
            <span className="text-xl leading-none animate-bounce">{r.emoji}</span>
            <span className="text-[11px] font-medium text-text-secondary truncate max-w-[80px]">
              {r.userName.split(' ')[0]}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
