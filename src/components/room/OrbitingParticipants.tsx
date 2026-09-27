import React, { useState } from 'react';
import { RoomMember } from '../../types';
import { Link } from 'react-router-dom';
import { Crown, Headphones, User, ExternalLink, X } from 'lucide-react';

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
  // 6: Top Center
  {
    containerClass: '-top-12 left-1/2 -translate-x-1/2',
    bubbleClass: '-top-8 left-1/2 -translate-x-1/2',
  },
  // 7: Bottom Center
  {
    containerClass: '-bottom-12 left-1/2 -translate-x-1/2',
    bubbleClass: '-bottom-8 left-1/2 -translate-x-1/2',
  },
];

export const OrbitingParticipants: React.FC<OrbitingParticipantsProps> = ({
  members,
  isMobile = false,
}) => {
  const [selectedMember, setSelectedMember] = useState<RoomMember | null>(null);

  // Mobile / Tablet Row View
  if (isMobile) {
    return (
      <div className="w-full py-3 px-2">
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-2 px-1">
          {members.map((member) => (
            <button
              key={member.id}
              onClick={() => setSelectedMember(member)}
              type="button"
              className="flex flex-col items-center gap-1.5 flex-shrink-0 group text-left focus:outline-none"
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
                      : 'ring-white/10 group-hover:ring-white/30'
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
            </button>
          ))}
        </div>

        {/* Member Preview Sheet */}
        {selectedMember && (
          <MemberPreviewCard
            member={selectedMember}
            onClose={() => setSelectedMember(null)}
          />
        )}
      </div>
    );
  }

  // Desktop Orbiting View
  return (
    <div className="absolute inset-0 pointer-events-none select-none hidden md:block">
      {members.slice(0, 8).map((member, idx) => {
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

            {/* Avatar button with interactive popup trigger */}
            <button
              type="button"
              onClick={() => setSelectedMember(member)}
              className="relative cursor-pointer focus:outline-none"
              title={`View ${member.user.name}'s profile`}
            >
              <img
                src={member.user.avatar}
                alt={member.user.name}
                className={`w-12 h-12 lg:w-14 lg:h-14 rounded-full object-cover ring-2 transition-all shadow-card-subtle ${
                  member.role === 'host'
                    ? 'ring-accent-cream ring-offset-2 ring-offset-bg shadow-lg shadow-amber-500/10'
                    : member.status === 'reacting'
                    ? 'ring-accent-emerald ring-offset-2 ring-offset-bg animate-pulse'
                    : 'ring-white/15 hover:ring-accent-cream/50'
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
            </button>

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

      {/* Member Profile Card Modal */}
      {selectedMember && (
        <div className="pointer-events-auto">
          <MemberPreviewCard
            member={selectedMember}
            onClose={() => setSelectedMember(null)}
          />
        </div>
      )}
    </div>
  );
};

interface MemberPreviewCardProps {
  member: RoomMember;
  onClose: () => void;
}

const MemberPreviewCard: React.FC<MemberPreviewCardProps> = ({ member, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xs bg-surface border border-border rounded-2xl p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1 text-text-muted hover:text-text-primary rounded-full hover:bg-surface-elevated transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3.5">
          <div className="relative w-14 h-14 rounded-2xl overflow-hidden border border-border/80 flex-shrink-0">
            <img
              src={member.user.avatar}
              alt={member.user.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-text-primary text-sm line-clamp-1">
                {member.user.name}
              </h3>
              {member.role === 'host' && (
                <span title="Room Host">
                  <Crown className="w-3.5 h-3.5 text-accent-cream" />
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted">@{member.user.username}</p>
            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-accent-emerald/10 border border-accent-emerald/30 text-[10px] font-medium text-accent-emerald">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse" />
              Listening Live
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-text-secondary">
          <span className="flex items-center gap-1">
            <Headphones className="w-3.5 h-3.5 text-accent-cream" /> Role
          </span>
          <span className="font-semibold capitalize text-text-primary">{member.role}</span>
        </div>

        <Link
          to={`/profile/${member.user.username}`}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-surface-elevated border border-border hover:border-accent-cream text-xs font-semibold text-text-primary hover:text-accent-cream transition"
          onClick={onClose}
        >
          <User className="w-3.5 h-3.5" />
          <span>View Full Profile</span>
          <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
        </Link>
      </div>
    </div>
  );
};
