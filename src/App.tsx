
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import { Toaster } from 'sonner';
import LandingPage from '@/pages/LandingPage';
import Auth from '@/pages/Auth';
import Dashboard from '@/pages/Dashboard';
import Loading from '@/components/ui/loading';
import { useAuth } from '@/contexts/AuthContext';
import { AppProviders } from '@/contexts/AppProviders';

// Lazy-loaded pages
const CreateGroup = lazy(() => import('@/pages/CreateGroup'));
const GroupDetail = lazy(() => import('@/pages/GroupDetail'));
const Explore = lazy(() => import('@/pages/Explore'));
const Profile = lazy(() => import('@/pages/UserProfile'));
const Settings = lazy(() => import('@/pages/Settings'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <Loading />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  return (
    <AppProviders>
      <Router>
        <Suspense fallback={<Loading />}>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<Auth />} />
            
            {/* Protected routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/create-group" element={
              <ProtectedRoute>
                <CreateGroup />
              </ProtectedRoute>
            } />
            <Route path="/groups/:id" element={
              <ProtectedRoute>
                <GroupDetail />
              </ProtectedRoute>
            } />
            <Route path="/explore" element={
              <ProtectedRoute>
                <Explore />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
          </Routes>
        </Suspense>
        
        <Toaster position="top-center" richColors />
      </Router>
    </AppProviders>
  );
}

export default App;
