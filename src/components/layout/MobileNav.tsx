import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Compass, Radio, PlusCircle, LogIn, User } from 'lucide-react';

export const MobileNav: React.FC = () => {
  const location = useLocation();

  // If inside a listening room on mobile, we hide main mobile nav to avoid crowding playback controls
  const isInsideRoom = location.pathname.startsWith('/room/');
  if (isInsideRoom) return null;

  const links = [
    { name: 'Discover', href: '/', icon: Compass },
    { name: 'Rooms', href: '/rooms', icon: Radio },
    { name: 'Create', href: '/create', icon: PlusCircle },
    { name: 'Join', href: '/join', icon: LogIn },
    { name: 'Identity', href: '/profile/alex', icon: User },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/90 backdrop-blur-lg border-t border-border px-3 py-2 pb-safe">
      <div className="flex items-center justify-around">
        {links.map((link) => {
          const isActive = location.pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.name}
              to={link.href}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors ${
                isActive ? 'text-accent-cream' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium tracking-tight">{link.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
