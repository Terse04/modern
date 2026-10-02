import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Radio, PlusCircle, LogIn, Bell, Shield, Home, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { AuthModal } from '../auth/AuthModal';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const { currentUser, isAuthenticated } = useAuthStore();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const navLinks = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Live Rooms', href: '/rooms', icon: Radio },
    { name: 'Host a Room', href: '/create', icon: PlusCircle },
    { name: 'Join', href: '/join', icon: LogIn },
    // Only rendered for admins. This is presentation, not authorization -
    // RequireAdmin on the route is what actually gates the page.
    ...(currentUser.isAdmin ? [{ name: 'Admin', href: '/admin', icon: Shield }] : []),
  ];

  const [showNotifications, setShowNotifications] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  const notifications: { id: string; title: string; text: string; time: string; href: string; }[] = [];

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-[#07080D]/85 backdrop-blur-xl border-b border-white/[0.07] h-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          {/* Brand / Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative w-8 h-8 rounded-full bg-gradient-to-tr from-teal-500/20 via-cyan-500/30 to-purple-600/20 border border-teal-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(20,184,166,0.3)] group-hover:shadow-[0_0_20px_rgba(20,184,166,0.5)] transition-all">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-400 group-hover:scale-110 transition-transform shadow-[0_0_8px_rgba(45,212,191,0.9)]" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-white group-hover:text-white/90 transition-colors">
              Modern
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5" aria-label="Main Navigation">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.name}
                  to={link.href}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-teal-500/15 border border-teal-500/40 text-white shadow-[0_0_15px_rgba(20,184,166,0.2)] font-semibold'
                      : 'text-white/60 hover:text-white hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-teal-400' : 'text-white/45'}`} />
                  <span>{link.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Actions: Notifications & Profile Trigger */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Interactive Notifications Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setHasUnread(false);
                }}
                className={`w-8 h-8 rounded-full border transition-all flex items-center justify-center cursor-pointer ${
                  showNotifications
                    ? 'bg-white/10 border-white/20 text-white'
                    : 'bg-white/[0.03] border-white/10 hover:border-white/20 text-white/60 hover:text-white'
                }`}
                title="Activity Notifications"
                aria-label="Activity Notifications"
              >
                <Bell className="w-3.5 h-3.5" />
                {hasUnread && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                )}
              </button>

              {/* Notifications Dropdown Popover */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-[#0C0E16]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between px-2 py-1.5 border-b border-white/[0.08] mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-white">
                      Recent Activity
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowNotifications(false)}
                      className="text-[11px] text-white/50 hover:text-white transition-colors"
                    >
                      Close
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-xs text-white/40">
                        No new notifications
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <Link
                          key={n.id}
                          to={n.href}
                          onClick={() => setShowNotifications(false)}
                          className="block p-2.5 rounded-xl hover:bg-white/[0.04] border border-transparent hover:border-white/10 transition-all text-left"
                        >
                          <div className="flex items-center justify-between text-xs font-semibold text-white mb-0.5">
                            <span>{n.title}</span>
                            <span className="text-[10px] text-white/40 font-normal">{n.time}</span>
                          </div>
                          <p className="text-xs text-white/60 line-clamp-1">{n.text}</p>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Interactive User Profile Pill */}
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-2 pl-1 pr-2.5 py-1 bg-[#10131C] hover:bg-[#161B27] border border-white/10 hover:border-white/20 rounded-full transition-all group cursor-pointer shadow-sm"
              title="Sound Identity & Account"
            >
              <div className="relative">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-6 h-6 rounded-full object-cover ring-1 ring-white/15"
                />
                <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ring-2 ring-[#10131C] ${
                  isAuthenticated ? 'bg-teal-400' : 'bg-amber-400'
                }`} />
              </div>
              <span className="text-xs font-medium text-white/85 group-hover:text-white leading-tight">
                @{currentUser.username.replace(/^@/, '')}
              </span>
              <ChevronDown className="w-3 h-3 text-white/40 group-hover:text-white/70 transition-colors" />
            </button>
          </div>
        </div>
      </header>

      {/* Auth & Identity Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
};
