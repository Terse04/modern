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
    { name: 'Admin', href: '/admin', icon: Shield },
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
          <div className="flex items-center gap-2.5 sm:gap-3">
            {!isAuthenticated && (
              <Link
                to="/login"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-text-primary bg-surface-elevated/70 border border-border hover:border-accent-cream transition-colors"
              >
                <span>Log In</span>
              </Link>
            )}

            <button
              className="p-2 text-text-muted hover:text-text-primary hover:bg-surface-elevated rounded-full transition-colors hidden sm:flex"
              title="Activity Notifications"
            >
              <Bell className="w-4 h-4" />
            </button>

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

