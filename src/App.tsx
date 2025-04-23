
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Toaster } from 'sonner';
import Auth from '@/pages/Auth';
import Dashboard from '@/pages/Dashboard';
import { useAuth } from '@/contexts/AuthContext';
import { AppProviders } from '@/contexts/AppProviders';
import Index from '@/pages/Index';
import Loading from '@/components/ui/loading';

// Lazy-loaded pages
const CreateGroup = lazy(() => import('@/pages/CreateGroup'));
const GroupDetail = lazy(() => import('@/pages/GroupDetail'));
const Profile = lazy(() => import('@/pages/UserProfile'));
const AllGroups = lazy(() => import('@/pages/AllGroups'));
const Votes = lazy(() => import('@/pages/Votes'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const Settings = lazy(() => import('@/pages/UserSettings'));

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
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin/auth" element={<Auth />} />
            
            {/* Protected routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/create-group"
              element={
                <ProtectedRoute>
                  <CreateGroup />
                </ProtectedRoute>
              }
            />
            <Route
              path="/groups/:id"
              element={
                <ProtectedRoute>
                  <GroupDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/groups"
              element={
                <ProtectedRoute>
                  <AllGroups />
                </ProtectedRoute>
              }
            />
            <Route
              path="/votes"
              element={
                <ProtectedRoute>
                  <Votes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            
            {/* Fallback route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        
        <Toaster position="top-center" richColors />
      </Router>
    </AppProviders>
  );
}

export default App;
