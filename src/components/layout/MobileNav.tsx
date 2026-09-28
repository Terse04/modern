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
    { name: 'Identity', href: '/profile', icon: User },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-bg/90 backdrop-blur-xl border-t border-border/50 px-2 pt-1.5 pb-safe">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {links.map((link) => {
          const isActive =
            link.href === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.name}
              to={link.href}
              className={`flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-accent-cream'
                  : 'text-text-muted active:text-text-secondary'
              }`}
            >
              <div className={`p-1 rounded-lg transition-colors ${
                isActive ? 'bg-accent-cream/10' : ''
              }`}>
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 1.8} />
              </div>
              <span className={`text-[10px] font-medium tracking-tight ${
                isActive ? 'text-accent-cream' : ''
              }`}>
                {link.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
