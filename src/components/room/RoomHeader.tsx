import React from 'react';
import { Users, Share2, UserPlus, Settings, ArrowLeft } from 'lucide-react';
import { Room } from '../../types';
import { Button } from '../ui/Button';
import { LiveBadge } from '../ui/Badge';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';

export interface RoomHeaderProps {
  room: Room;
  listenerCount?: number;
  onOpenInvite: () => void;
  onOpenSettings: () => void;
  onOpenAuth?: () => void;
}

export const RoomHeader: React.FC<RoomHeaderProps> = ({
  room,
  listenerCount,
  onOpenInvite,
  onOpenSettings,
  onOpenAuth,
}) => {
  const { currentUser, isAuthenticated } = useAuthStore();
  const count = listenerCount !== undefined ? listenerCount : (room.listenerCount || 1);

  return (
    <header className="w-full flex items-center justify-between py-2.5 sm:py-3.5 px-3 sm:px-6 border-b border-border/30 bg-bg/70 backdrop-blur-xl flex-shrink-0 z-20">
      {/* Left: Back + Room Title + Listener Count */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <Link
          to="/"
          className="p-1.5 sm:p-2 text-text-muted hover:text-text-primary hover:bg-surface-elevated rounded-full transition-colors flex-shrink-0"
          title="Back to Discover"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </Link>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xs sm:text-sm md:text-base font-bold tracking-tight text-text-primary uppercase font-display truncate max-w-[150px] xs:max-w-[220px] sm:max-w-none">
              {room.name}
            </h1>
            <span className="text-text-muted/50 text-xs hidden sm:inline">|</span>
            <LiveBadge size="sm" />
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] sm:text-xs text-text-secondary">
            <Users className="w-3 h-3 text-text-muted" />
            <span>{count} {count === 1 ? 'listener' : 'listeners'}</span>
          </div>
        </div>
      </div>

      {/* Center: Host Badge (Desktop) */}
      <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-surface-elevated/70 border border-border rounded-full">
        <img
          src={room.host.avatar}
          alt={room.host.name}
          className="w-5 h-5 rounded-full object-cover ring-1 ring-white/10"
        />
        <span className="text-xs text-text-secondary">Host</span>
        <span className="text-xs font-semibold text-text-primary">@{room.host.username}</span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
        <Button
          variant="secondary"
          size="sm"
          onClick={onOpenInvite}
          className="hidden sm:inline-flex"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>SHARE</span>
        </Button>

        <Button
          variant="primary"
          size="sm"
          onClick={onOpenInvite}
          className="shadow-sm font-semibold tracking-wide text-xs sm:text-sm"
          title="Invite Friends"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">INVITE</span>
        </Button>

        <Button
          variant="icon"
          size="sm"
          onClick={onOpenSettings}
          title="Room Settings"
          aria-label="Room Settings"
        >
          <Settings className="w-4 h-4" />
        </Button>

        {/* User Identity Pill in Room */}
        {onOpenAuth && (
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-1 pl-0.5 pr-2 py-0.5 bg-surface-elevated/80 border border-border hover:border-border-focus rounded-full transition-all group"
            title="Switch Persona / Sign In"
          >
            <div className="relative">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover ring-1 ring-white/10"
              />
              <span className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ring-1 ring-surface ${
                isAuthenticated ? 'bg-accent-emerald' : 'bg-accent-amber'
              }`} />
            </div>
            <span className="text-[10px] sm:text-[11px] font-medium text-text-primary group-hover:text-accent-cream truncate max-w-[50px] sm:max-w-[80px]">
              @{currentUser.username}
            </span>
          </button>
        )}
      </div>
    </header>
  );
};
