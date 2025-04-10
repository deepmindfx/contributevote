
import { Routes, Route, Navigate } from 'react-router-dom';
import Index from './pages/Index';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';
import { AppProvider } from './contexts/AppContext';
import CreateGroup from './pages/CreateGroup';
import GroupDetail from './pages/GroupDetail';
import AllGroups from './pages/AllGroups';
import UserProfile from './pages/UserProfile';
import AdminAuth from './pages/AdminAuth';
import AdminDashboard from './pages/admin/Dashboard';
import ContributePage from './pages/ContributePage';
import ContributeSharePage from './pages/ContributeSharePage';
import UserSettings from './pages/UserSettings';
import VirtualAccount from './pages/VirtualAccount';
import Votes from './pages/Votes';
import WalletHistory from './pages/WalletHistory';
import { Toaster } from 'sonner';

function App() {
  return (
    <AppProvider>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/admin/auth" element={<AdminAuth />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/create-group" element={<CreateGroup />} />
        <Route path="/groups" element={<AllGroups />} />
        <Route path="/groups/:id" element={<GroupDetail />} />
        <Route path="/contribute/:id" element={<ContributePage />} />
        <Route path="/contribute/share/:id" element={<ContributeSharePage />} />
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/settings" element={<UserSettings />} />
        <Route path="/virtual-account" element={<VirtualAccount />} />
        <Route path="/votes" element={<Votes />} />
        <Route path="/wallet-history" element={<WalletHistory />} />
        <Route path="/not-found" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/not-found" />} />
      </Routes>
      <Toaster position="top-center" closeButton />
    </AppProvider>
  );
}

export default App;
