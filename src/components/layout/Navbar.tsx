import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Disc3, Compass, Radio, PlusCircle, LogIn, Bell, ShieldCheck, Shield } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { AuthModal } from '../auth/AuthModal';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const { currentUser, isAuthenticated } = useAuthStore();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const navLinks = [
    { name: 'Discover', href: '/', icon: Compass },
    { name: 'Live Rooms', href: '/rooms', icon: Radio },
    { name: 'Create Room', href: '/create', icon: PlusCircle },
    { name: 'Join Room', href: '/join', icon: LogIn },
    // Only rendered for admins. This is presentation, not authorization -
    // RequireAdmin on the route is what actually gates the page.
    ...(currentUser.isAdmin ? [{ name: 'Admin', href: '/admin', icon: Shield }] : []),
  ];

  const [showNotifications, setShowNotifications] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);

  const notifications = [
    {
      id: 'n1',
      title: 'Late Night Coding',
      text: 'Alex is broadcasting ambient synth in sync',
      time: '2m ago',
      href: '/room/late-night-coding',
    },
    {
      id: 'n2',
      title: 'Sound Identity',
      text: 'Your account is connected to Supabase Realtime',
      time: '15m ago',
      href: '/profile',
    },
    {
      id: 'n3',
      title: 'Listening Circle',
      text: 'Elena and Marcus joined a room',
      time: '45m ago',
      href: '/rooms',
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-bg/80 backdrop-blur-md border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand / Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-full bg-surface-elevated border border-white/10 flex items-center justify-center text-text-primary group-hover:border-white/25 transition-all">
              <Disc3 className="w-4 h-4 text-accent-cream group-hover:rotate-45 transition-transform duration-300" />
            </div>
            <span className="font-display font-semibold text-lg tracking-tight text-text-primary">
              Modern
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.name}
                  to={link.href}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-surface-elevated text-text-primary border border-border'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-subtle'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-accent-cream' : 'text-text-muted'}`} />
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* Right Actions: Notifications & Profile Switcher */}
          <div className="flex items-center gap-2.5 sm:gap-3 relative">
            {!isAuthenticated && (
              <Link
                to="/login"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-text-primary bg-surface-elevated/70 border border-border hover:border-accent-cream transition-colors"
              >
                <span>Log In</span>
              </Link>
            )}

            {/* Interactive Notifications Button */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setHasUnread(false);
                }}
                className={`p-2 rounded-full transition-colors hidden sm:flex relative ${
                  showNotifications
                    ? 'text-accent-cream bg-surface-elevated border border-border'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-elevated'
                }`}
                title="Activity Notifications"
              >
                <Bell className="w-4 h-4" />
                {hasUnread && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent-amber animate-pulse" />
                )}
              </button>

              {/* Notifications Dropdown Popover */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-surface/95 backdrop-blur-xl border border-border/80 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/40 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
                      Recent Activity
                    </span>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-[11px] text-text-muted hover:text-text-primary"
                    >
                      Close
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {notifications.map((n) => (
                      <Link
                        key={n.id}
                        to={n.href}
                        onClick={() => setShowNotifications(false)}
                        className="block p-2.5 rounded-xl hover:bg-surface-elevated border border-transparent hover:border-border/40 transition-all text-left"
                      >
                        <div className="flex items-center justify-between text-xs font-semibold text-text-primary mb-0.5">
                          <span>{n.title}</span>
                          <span className="text-[10px] text-text-muted font-normal">{n.time}</span>
                        </div>
                        <p className="text-xs text-text-secondary line-clamp-1">{n.text}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Interactive User Profile & Auth Trigger */}
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-2 pl-1.5 pr-3 py-1 bg-surface-elevated border border-border hover:border-border-focus rounded-full transition-all group cursor-pointer"
              title="Change Sound Identity or Sign In"
            >
              <div className="relative">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-7 h-7 rounded-full object-cover ring-1 ring-white/10"
                />
                <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ring-2 ring-surface ${
                  isAuthenticated ? 'bg-accent-emerald' : 'bg-accent-amber'
                }`} />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-medium text-text-primary group-hover:text-accent-cream leading-tight">
                  @{currentUser.username}
                </span>
                <span className="text-[9px] text-text-muted flex items-center gap-0.5">
                  {isAuthenticated ? (
                    <>
                      <ShieldCheck className="w-2.5 h-2.5 text-accent-emerald" /> Supabase
                    </>
                  ) : (
                    'Switch Profile'
                  )}
                </span>
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Auth & Identity Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
};

