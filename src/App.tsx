
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppProviders } from '@/contexts/AppProviders';
import Auth from '@/pages/Auth';
import Dashboard from '@/pages/Dashboard';
import Loading from '@/components/ui/loading';
import Index from '@/pages/Index';

// Lazy-loaded pages
const CreateGroup = lazy(() => import('@/pages/CreateGroup'));
const GroupDetail = lazy(() => import('@/pages/GroupDetail'));
const Explore = lazy(() => import('@/pages/Explore'));
const Profile = lazy(() => import('@/pages/UserProfile')); // Corrected import
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

// Import useAuth after the AuthProvider is defined to prevent circular dependencies
import { useAuth } from '@/contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      <AppProviders>
        <Router>
          <Suspense fallback={<Loading />}>
            <Routes>
              {/* Landing page */}
              <Route path="/" element={<Index />} />
              
              {/* Authentication */}
              <Route path="/auth" element={<Auth />} />
              
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
                path="/explore"
                element={
                  <ProtectedRoute>
                    <Explore />
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
            </Routes>
          </Suspense>
          <Toaster position="top-center" richColors />
        </Router>
      </AppProviders>
    </AuthProvider>
  );
}

export default App;
