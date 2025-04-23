
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import CreateGroup from "@/pages/CreateGroup";
import GroupDetail from "@/pages/GroupDetail";
import ContributePage from "@/pages/ContributePage";
import AllGroups from "@/pages/AllGroups";
import Votes from "@/pages/Votes";
import AdminAuth from "@/pages/AdminAuth";

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/admin/auth" element={<AdminAuth />} />
      
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      
      <Route
        path="/create-group"
        element={
          <PrivateRoute>
            <CreateGroup />
          </PrivateRoute>
        }
      />
      
      <Route
        path="/groups/:id"
        element={
          <PrivateRoute>
            <GroupDetail />
          </PrivateRoute>
        }
      />
      
      <Route
        path="/contribute/:id"
        element={
          <PrivateRoute>
            <ContributePage />
          </PrivateRoute>
        }
      />
      
      <Route
        path="/groups"
        element={
          <PrivateRoute>
            <AllGroups />
          </PrivateRoute>
        }
      />
      
      <Route
        path="/votes"
        element={
          <PrivateRoute>
            <Votes />
          </PrivateRoute>
        }
      />
    </Routes>
  );
};

export default AppRoutes;
