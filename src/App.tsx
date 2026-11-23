import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigationType } from "react-router-dom";
import { SupabaseUserProvider } from "@/contexts/SupabaseUserContext";
import { SupabaseContributionProvider } from "@/contexts/SupabaseContributionContext";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import NotFound from "./pages/NotFound";
import WorkspaceNavigation from "@/components/layout/WorkspaceNavigation";
import { getWorkspaceLink } from "@/components/layout/navigationItems";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionRecovery } from "@/components/auth/SessionRecovery";
import { applyAppearance, usesDarkMode } from "@/lib/appearance";
import { Suspense, useEffect, useState, Component, ErrorInfo, ReactNode, lazy } from "react";
import { preloadLinkedScreen, preloadScreen, preloadWorkspaceScreens, recoverFromStaleChunk, screens } from "./routeScreens";

// Error Boundary Component
interface ErrorBoundaryState {
  hasError: boolean;
  reloading?: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, reloading: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, reloading: false, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (recoverFromStaleChunk(error)) {
      this.setState({ reloading: true });
      return;
    }
    console.error('App Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.state.reloading) {
        return <RouteSkeleton />;
      }
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
const TestTransferAPI = import.meta.env.DEV ? lazy(() => import("./pages/TestTransferAPI")) : null;
preloadScreen(window.location.pathname);

const queryClient = new QueryClient();

const TOP_LEVEL_TABS = new Set([
  "/",
  "/dashboard",
  "/all-groups",
  "/votes",
  "/discover",
  "/settings",
  "/admin",
]);

function RouteSkeleton() {
  const [visible, setVisible] = useState(false);

  // Avoid flashing a skeleton on fast cached transitions; show subtle native top progress + soft placeholder only if loading > 110ms
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 110);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) {
    return <div className="min-h-[60dvh]" role="status" aria-label="Loading screen" />;
  }

  return (
    <>
      <div className="cp-nav-progress" aria-hidden="true" />
      <main className="app-page mx-auto max-w-3xl space-y-4 cp-screen-enter-tab" role="status" aria-label="Loading screen">
        <Skeleton className="h-8 w-40 rounded-xl" />
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </main>
    </>
  );
}

// Admin route guard
const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { isAdmin, isAuthenticated, loading, sessionUnavailable } = useSupabaseUser();
  if (loading) return <RouteSkeleton />;
  if (sessionUnavailable) return <SessionRecovery />;
  
  if (!isAuthenticated) {
    return <Navigate to="/admin-login" replace />;
  }
  
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

// Auth guard to keep logged out users from accessing protected routes
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, loading, sessionUnavailable } = useSupabaseUser();
  const { pathname, search, hash } = useLocation();
  
  if (loading) return <RouteSkeleton />;
  if (sessionUnavailable) return <SessionRecovery />;
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace state={{ returnUrl: pathname + search + hash }} />;
  }
  
  return <>{children}</>;
};

const AppRoutes = () => {
  const { user, isAuthenticated, isAdmin } = useSupabaseUser();
  useEffect(() => {
    if (isAuthenticated && isAdmin) return;
    queryClient.removeQueries({
      predicate: ({ queryKey }) => typeof queryKey[0] === "string" && queryKey[0].startsWith("admin-"),
    });
  }, [isAuthenticated, isAdmin, user?.id]);
  const darkMode = usesDarkMode(user?.preferences);
  const { pathname } = useLocation();
  const navType = useNavigationType();
  const normalizedPath = pathname.replace(/\/$/, "") || "/";
  const isWorkspace = isAuthenticated && Boolean(getWorkspaceLink(pathname));

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  
  useEffect(() => {
    applyAppearance(darkMode);
  }, [darkMode, pathname]);

  // Quietly warm core authenticated tabs & screens during idle time so taps feel instant like a native app
  useEffect(() => {
    if (isAuthenticated) {
      preloadWorkspaceScreens();
    }
  }, [isAuthenticated]);

  const screenTransitionClass =
    navType === "POP"
      ? "cp-screen-stage cp-screen-enter-pop"
      : TOP_LEVEL_TABS.has(normalizedPath)
      ? "cp-screen-stage cp-screen-enter-tab"
      : "cp-screen-stage cp-screen-enter-push";

  const routes = (
    <Routes>
      <Route path="/" element={<screens.index />} />
      <Route path="/auth" element={<screens.auth />} />
      <Route path="/admin-login" element={<screens.adminAuth />} />
      <Route path="/discover" element={<screens.discover />} />
      <Route path="/faq" element={<screens.faq />} />
      <Route path="/support" element={<ProtectedRoute><screens.support /></ProtectedRoute>} />
      
      {/* Protected Routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <screens.dashboard />
        </ProtectedRoute>
      } />
      <Route path="/create-group" element={
        <ProtectedRoute>
          <screens.createGroup />
        </ProtectedRoute>
      } />
      <Route path="/groups/:id" element={
        <ProtectedRoute>
          <screens.group />
        </ProtectedRoute>
      } />
      <Route path="/contribute/:id" element={
        <ProtectedRoute>
          <screens.contribute />
        </ProtectedRoute>
      } />
      <Route path="/contribute/share/:id" element={<screens.contributeShare />} />
      <Route path="/settings" element={
        <ProtectedRoute>
          <screens.settings />
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          <screens.profile />
        </ProtectedRoute>
      } />
      <Route path="/wallet-history" element={
        <ProtectedRoute>
          <screens.walletHistory />
        </ProtectedRoute>
      } />
      <Route path="/fixed-savings" element={<ProtectedRoute><screens.fixedSavings /></ProtectedRoute>} />
      <Route path="/terms/ice-vault/v1" element={<screens.iceVaultTerms />} />
      <Route path="/activity" element={
        <ProtectedRoute>
          <screens.activity />
        </ProtectedRoute>
      } />
      <Route path="/votes" element={
        <ProtectedRoute>
          <screens.votes />
        </ProtectedRoute>
      } />
      <Route path="/all-groups" element={
        <ProtectedRoute>
          <screens.groups />
        </ProtectedRoute>
      } />
      <Route path="/join/:id" element={<screens.join />} />
      <Route path="/invite/:token" element={<screens.invite />} />
      <Route path="/transfer/bulk" element={<ProtectedRoute><screens.bulkTransfer /></ProtectedRoute>} />
      <Route path="/transfer/bulk/history" element={<ProtectedRoute><screens.bulkTransferHistory /></ProtectedRoute>} />
      <Route path="/transfer" element={
        <ProtectedRoute>
          <screens.transfer />
        </ProtectedRoute>
      } />
      
      {/* Test Transfer API Route - Development only */}
      {TestTransferAPI && (
        <Route path="/test-transfer-api" element={
          <ProtectedRoute>
            <TestTransferAPI />
          </ProtectedRoute>
        } />
      )}
      
      {/* Migration Route - Removed for production security */}
      
      {/* Payment Callback Route */}
      <Route path="/payment-callback" element={<ProtectedRoute><screens.payment /></ProtectedRoute>} />
      
      {/* Admin Routes */}
      <Route path="/admin" element={
        <AdminRoute>
          <screens.admin />
        </AdminRoute>
      } />
      <Route path="/admin/*" element={
        <AdminRoute>
          <screens.admin />
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

  const intentHandlers = {
    onMouseOver: (event: React.MouseEvent) => preloadLinkedScreen(event.target),
    onFocus: (event: React.FocusEvent) => preloadLinkedScreen(event.target),
    onPointerDown: (event: React.PointerEvent) => preloadLinkedScreen(event.target),
    onTouchStart: (event: React.TouchEvent) => preloadLinkedScreen(event.target),
  };
  const content = (
    <Suspense fallback={<RouteSkeleton />}>
      <div key={normalizedPath} className={screenTransitionClass}>
        {routes}
      </div>
    </Suspense>
  );

  return isWorkspace ? (
    <div {...intentHandlers} className={["/create-group", "/transfer"].includes(pathname.replace(/\/$/, "")) ? "app-workspace app-workspace--focused" : "app-workspace"}>
      <WorkspaceNavigation />
      {content}
    </div>
  ) : <div {...intentHandlers}>{content}</div>;
};

const App = () => {
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
