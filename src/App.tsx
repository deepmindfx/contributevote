import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SupabaseUserProvider } from "@/contexts/SupabaseUserContext";
import { SupabaseContributionProvider } from "@/contexts/SupabaseContributionContext";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AdminAuth from "./pages/AdminAuth";
import Dashboard from "./pages/Dashboard";
import CreateGroup from "./pages/CreateGroup";
import ContributePage from "./pages/ContributePage";
import ContributeSharePage from "./pages/ContributeSharePage";
import GroupDetail from "./pages/GroupDetail";
import UserSettings from "./pages/UserSettings";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/admin/Dashboard";
import UserProfile from "./pages/UserProfile";
import Discover from "./pages/Discover";
import React, { useEffect, Component, ErrorInfo, ReactNode } from "react";

// Error Boundary Component
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold text-destructive mb-4">
              Something went wrong
            </h1>
            <p className="text-muted-foreground mb-4">
              The application encountered an error. Please refresh the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
import WalletHistory from "./pages/WalletHistory";
import ActivityHistory from "./pages/ActivityHistory";
import Votes from "./pages/Votes";
import AllGroups from "./pages/AllGroups";
import JoinGroup from "./pages/JoinGroup";
import TransferForm from "./components/TransferForm";
import PaymentCallback from "./pages/PaymentCallback";

const queryClient = new QueryClient();

// Admin route guard
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin, isAuthenticated } = useSupabaseUser();
  
  if (!isAuthenticated) {
    return <Navigate to="/admin-login" replace />;
  }
  
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

// Auth guard to keep logged out users from accessing protected routes
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useSupabaseUser();
  
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
};

const AppRoutes = () => {
  const { user, isAuthenticated, isAdmin, loading } = useSupabaseUser();
  
  // Apply dark mode on route change if user has it enabled
  // This MUST come before any early returns to follow Rules of Hooks
  useEffect(() => {
    const preferences = user?.preferences as any;
    if (preferences?.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [user?.preferences]);
  
  // Show loading spinner while user context is initializing
  // But only for a maximum of 3 seconds to prevent infinite loading
  const [showLoading, setShowLoading] = React.useState(loading);
  
  React.useEffect(() => {
    if (loading) {
      setShowLoading(true);
      // Force stop loading after 3 seconds
      const timeout = setTimeout(() => {
        setShowLoading(false);
      }, 3000);
      return () => clearTimeout(timeout);
    } else {
      setShowLoading(false);
    }
  }, [loading]);
  
  if (showLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/admin-login" element={<AdminAuth />} />
      <Route path="/discover" element={<Discover />} />
      
      {/* Protected Routes */}
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
      <Route path="/contribute/:id" element={
        <ProtectedRoute>
          <ContributePage />
        </ProtectedRoute>
      } />
      <Route path="/contribute/share/:id" element={<ContributeSharePage />} />
      <Route path="/settings" element={
        <ProtectedRoute>
          <UserSettings />
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          <UserProfile />
        </ProtectedRoute>
      } />
      <Route path="/wallet-history" element={
        <ProtectedRoute>
          <WalletHistory />
        </ProtectedRoute>
      } />
      <Route path="/activity" element={
        <ProtectedRoute>
          <ActivityHistory />
        </ProtectedRoute>
      } />
      <Route path="/votes" element={
        <ProtectedRoute>
          <Votes />
        </ProtectedRoute>
      } />
      <Route path="/all-groups" element={
        <ProtectedRoute>
          <AllGroups />
        </ProtectedRoute>
      } />
      <Route path="/join/:id" element={<JoinGroup />} />
      <Route path="/transfer" element={
        <ProtectedRoute>
          <TransferForm />
        </ProtectedRoute>
      } />
      
      {/* Migration Route - Removed for production security */}
      
      {/* Payment Callback Route */}
      <Route path="/payment-callback" element={<PaymentCallback />} />
      
      {/* Admin Routes */}
      <Route path="/admin" element={
        <AdminRoute>
          <AdminDashboard />
        </AdminRoute>
      } />
      <Route path="/admin/*" element={
        <AdminRoute>
          <AdminDashboard />
        </AdminRoute>
      } />
      
      {/* Admin Redirect for Admin Users */}
      {isAdmin && (
        <Route path="/admin-redirect" element={<Navigate to="/admin" replace />} />
      )}
      
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => {
  useEffect(() => {
    // Set Roboto font as the default font
    document.body.classList.add('font-roboto');
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true
          }}
        >
          <SupabaseUserProvider>
            <SupabaseContributionProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <AppRoutes />
              </TooltipProvider>
            </SupabaseContributionProvider>
          </SupabaseUserProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
