import React, { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { MobileNav } from './components/layout/MobileNav';
import { ToastContainer } from './components/ui/Toast';
import { DiscoverPage } from './pages/DiscoverPage';
import { RoomPage } from './pages/RoomPage';
import { CreateRoomPage } from './pages/CreateRoomPage';
import { JoinRoomPage } from './pages/JoinRoomPage';
import { ProfilePage } from './pages/ProfilePage';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { RequireAdmin } from './components/auth/RequireAdmin';
import { useAuthStore } from './stores/useAuthStore';

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
        </Routes>
      </main>
      {!isRoomView && <MobileNav />}
      <ToastContainer />
    </div>
  );
};

export default App;
