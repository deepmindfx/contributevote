
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "@/contexts/AppContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import CreateGroup from "./pages/CreateGroup";
import GroupDetail from "./pages/GroupDetail";
import ContributePage from "./pages/ContributePage";
import UserSettings from "./pages/UserSettings";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/admin/Dashboard";
import { useEffect } from "react";

const queryClient = new QueryClient();

// Admin route guard
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin } = useApp();
  
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

const AppRoutes = () => {
  const { isAdmin } = useApp();
  
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/create-group" element={<CreateGroup />} />
      <Route path="/groups/:id" element={<GroupDetail />} />
      <Route path="/contribute/:id" element={<ContributePage />} />
      <Route path="/settings" element={<UserSettings />} />
      
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
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </AppProvider>
    </QueryClientProvider>
  );
};

export default App;
