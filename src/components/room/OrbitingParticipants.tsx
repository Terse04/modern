import React from 'react';
import { RoomMember } from '../../types';

export interface OrbitingParticipantsProps {
  members: RoomMember[];
  isMobile?: boolean;
}

// Preset orbiting anchor positions relative to the center square artwork
const DESKTOP_POSITIONS = [
  // 0: Top Left (Host)
  {
    containerClass: 'top-6 -left-12 lg:-left-20 xl:-left-28',
    bubbleClass: '-top-9 -left-4',
  },
  // 1: Middle Left (Just Joined)
  {
    containerClass: 'top-1/2 -translate-y-1/2 -left-16 lg:-left-24 xl:-left-36',
    bubbleClass: '-top-8 left-2',
  },
  // 2: Bottom Left (Listening)
  {
    containerClass: 'bottom-8 -left-10 lg:-left-16 xl:-left-24',
    bubbleClass: '-bottom-8 left-0',
  },
  // 3: Top Right (Reacting)
  {
    containerClass: 'top-6 -right-12 lg:-right-20 xl:-right-28',
    bubbleClass: '-top-9 -right-4',
  },
  // 4: Middle Right (Listening)
  {
    containerClass: 'top-1/2 -translate-y-1/2 -right-16 lg:-right-24 xl:-right-36',
    bubbleClass: '-top-8 right-2',
  },
  // 5: Bottom Right (Listening / Adding)
  {
    containerClass: 'bottom-8 -right-10 lg:-right-16 xl:-right-24',
    bubbleClass: '-bottom-8 right-0',
  },
];

export const OrbitingParticipants: React.FC<OrbitingParticipantsProps> = ({
  members,
  isMobile = false,
}) => {
  // Mobile / Tablet Row View
  if (isMobile) {
    return (
      <div className="w-full py-3 px-2">
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-2 px-1">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
            >
              <div className="relative">
                <img
                  src={member.user.avatar}
                  alt={member.user.name}
                  className={`w-11 h-11 rounded-full object-cover ring-2 transition-all ${
                    member.role === 'host'
                      ? 'ring-accent-cream ring-offset-2 ring-offset-bg'
                      : member.status === 'reacting'
                      ? 'ring-accent-emerald ring-offset-2 ring-offset-bg animate-pulse'
                      : 'ring-white/10'
                  }`}
                />
                {/* Active reaction pill */}
                {member.activeReaction && (
                  <span className="absolute -top-1.5 -right-1 text-xs bg-surface-elevated rounded-full p-0.5 border border-border shadow-md">
                    {member.activeReaction}
                  </span>
                )}
                {/* Status Dot */}
                <span
                  className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-bg ${
                    member.role === 'host'
                      ? 'bg-accent-cream'
                      : member.status === 'joined'
                      ? 'bg-blue-400'
                      : 'bg-accent-emerald'
                  }`}
                />
              </div>

              <span className="text-[11px] font-medium text-text-secondary truncate max-w-[65px]">
                {member.user.name.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Desktop Orbiting View
  return (
    <div className="absolute inset-0 pointer-events-none select-none hidden md:block">
      {members.slice(0, 6).map((member, idx) => {
        const pos = DESKTOP_POSITIONS[idx] || DESKTOP_POSITIONS[0];
        const hasSpeech = Boolean(member.speechBubble?.text);

        return (
          <div
            key={member.id}
            className={`absolute ${pos.containerClass} pointer-events-auto flex flex-col items-center group transition-all duration-300 hover:scale-105`}
          >
            {/* Speech bubble / message preview if present */}
            {hasSpeech && (
              <div
                className={`absolute ${pos.bubbleClass} z-20 whitespace-nowrap bg-surface-elevated/95 backdrop-blur-md text-text-primary text-[11px] font-medium px-3 py-1.5 rounded-full border border-border/80 shadow-lg animate-float-slow`}
              >
                <div className="flex items-center gap-1.5">
                  {member.activeReaction && <span>{member.activeReaction}</span>}
                  <span>{member.speechBubble?.text}</span>
                </div>
              </div>
            )}

            {/* Avatar with dynamic ring */}
            <div className="relative">
              <img
                src={member.user.avatar}
                alt={member.user.name}
                className={`w-12 h-12 lg:w-14 lg:h-14 rounded-full object-cover ring-2 transition-all shadow-card-subtle ${
                  member.role === 'host'
                    ? 'ring-accent-cream ring-offset-2 ring-offset-bg'
                    : member.status === 'reacting'
                    ? 'ring-accent-emerald ring-offset-2 ring-offset-bg animate-pulse'
                    : 'ring-white/15 hover:ring-white/30'
                }`}
              />

              {/* Status Indicator Dot */}
              <span
                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-bg ${
                  member.role === 'host'
                    ? 'bg-accent-cream'
                    : member.status === 'joined'
                    ? 'bg-blue-400'
                    : 'bg-accent-emerald'
                }`}
              />
            </div>

            {/* Status Pill beneath avatar */}
            <div className="mt-1.5 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-elevated/90 border border-border/60 shadow-sm backdrop-blur-sm">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  member.role === 'host'
                    ? 'bg-accent-cream'
                    : member.status === 'joined'
                    ? 'bg-blue-400'
                    : 'bg-accent-emerald'
                }`}
              />
              <span className="text-[10px] font-medium tracking-tight text-text-primary capitalize">
                {member.statusText || member.status}
              </span>
            </div>

            {/* Username subtitle on hover */}
            <span className="text-[10px] text-text-muted mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              @{member.user.username}
            </span>
          </div>
        );
      })}
    </div>
  );
};
