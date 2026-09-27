import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

/**
 * Route guard for privileged pages.
 *
 * /admin previously rendered with no guard at all. Combined with
 * `isAdmin: p.username === 'alex'` in adminService, that meant any anonymous
 * visitor could ban users, delete rooms, and delete tracks. The database
 * agreed: the profiles UPDATE policy allowed any holder of the publishable key
 * to set is_admin on their own row.
 *
 * IMPORTANT: this is a UX guard, not a security boundary. It hides the page,
 * it does not protect the data. The real boundary is RLS - see
 * supabase/migrations/20260927000200_rls_policies.sql - plus the
 * guard_profile_privileges() trigger, which is what actually stops a
 * non-admin from writing is_admin. Never rely on this component for
 * authorization decisions; it exists so users do not land on a page that will
 * fail every query.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const currentUser = useAuthStore((s) => s.currentUser);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const location = useLocation();

  // With no database there is no server-side admin claim to read. The demo
  // opt-in lives in adminService; mirror it here so the guard agrees.
  const demoAdmin = !isSupabaseConfigured && import.meta.env.VITE_DEMO_ADMIN === 'true';

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-border border-t-accent-emerald rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated && !demoAdmin) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (!currentUser.isAdmin && !demoAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 py-24">
        <div className="max-w-md text-center">
          <div className="w-12 h-12 mx-auto mb-5 rounded-full bg-surface-elevated border border-border flex items-center justify-center">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-text-muted"
              aria-hidden="true"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="font-display text-xl text-text-primary mb-2">Admins only</h1>
          <p className="text-sm text-text-secondary leading-relaxed">
            This account does not have administrator privileges. If you believe
            that is wrong, ask an existing admin to grant them.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
