import React, { Suspense, useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { MobileNav } from './components/layout/MobileNav';
import { ToastContainer } from './components/ui/Toast';
import { useAuthStore } from './stores/useAuthStore';

// Route-level code splitting — each page is loaded on demand
const DiscoverPage = React.lazy(() =>
  import('./pages/DiscoverPage').then((m) => ({ default: m.DiscoverPage }))
);
const RoomPage = React.lazy(() =>
  import('./pages/RoomPage').then((m) => ({ default: m.RoomPage }))
);
const CreateRoomPage = React.lazy(() =>
  import('./pages/CreateRoomPage').then((m) => ({ default: m.CreateRoomPage }))
);
const JoinRoomPage = React.lazy(() =>
  import('./pages/JoinRoomPage').then((m) => ({ default: m.JoinRoomPage }))
);
const ProfilePage = React.lazy(() =>
  import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage }))
);
const LoginPage = React.lazy(() =>
  import('./pages/LoginPage').then((m) => ({ default: m.LoginPage }))
);
const AdminDashboardPage = React.lazy(() =>
  import('./pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage }))
);
const RequireAdmin = React.lazy(() =>
  import('./components/auth/RequireAdmin').then((m) => ({ default: m.RequireAdmin }))
);

/** Minimal loading spinner shown while a lazy chunk loads */
const PageLoader: React.FC = () => (
  <div className="flex-1 flex items-center justify-center min-h-[40vh]">
    <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
  </div>
);

const App: React.FC = () => {
  const location = useLocation();
  const isRoomView = location.pathname.startsWith('/room/');

  useEffect(() => {
    const cleanup = useAuthStore.getState().initAuth();
    return cleanup;
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text-primary">
      {!isRoomView && <Navbar />}
      <main className="flex-1 flex flex-col">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<DiscoverPage />} />
            <Route path="/rooms" element={<DiscoverPage />} />
            <Route path="/room/:roomId" element={<RoomPage />} />
            <Route path="/create" element={<CreateRoomPage />} />
            <Route path="/join" element={<JoinRoomPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/:username" element={<ProfilePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <AdminDashboardPage />
                </RequireAdmin>
              }
            />
            {/* LOW-01: Catch-all 404 redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      {!isRoomView && <MobileNav />}
      <ToastContainer />
    </div>
  );
};

export default App;
