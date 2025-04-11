
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import { Toaster } from './components/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';
import { ThemeProvider } from "./components/ui/theme-provider";
import Dashboard from './pages/Dashboard';
import Index from './pages/Index';
import Auth from './pages/Auth';
import AdminAuth from './pages/AdminAuth';
import CreateGroup from './pages/CreateGroup';
import GroupDetail from './pages/GroupDetail';
import ContributePage from './pages/ContributePage';
import ContributeSharePage from './pages/ContributeSharePage';
import UserSettings from './pages/UserSettings';
import WalletHistory from './pages/WalletHistory';
import Votes from './pages/Votes';
import AllGroups from './pages/AllGroups';
import UserProfile from './pages/UserProfile';
import ActivityHistory from './pages/ActivityHistory';
import AdminDashboard from './pages/admin/Dashboard';
import SendMoney from './pages/SendMoney';
import NotFound from './pages/NotFound';
import './App.css';

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <AppProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin/auth" element={<AdminAuth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/create-group" element={<CreateGroup />} />
            <Route path="/group/:id" element={<GroupDetail />} />
            <Route path="/contribute/:id" element={<ContributePage />} />
            <Route path="/contribute/share/:id" element={<ContributeSharePage />} />
            <Route path="/settings" element={<UserSettings />} />
            <Route path="/wallet-history" element={<WalletHistory />} />
            <Route path="/votes" element={<Votes />} />
            <Route path="/all-groups" element={<AllGroups />} />
            <Route path="/user/:id" element={<UserProfile />} />
            <Route path="/activity-history" element={<ActivityHistory />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/send-money" element={<SendMoney />} />
            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
          <SonnerToaster position="top-right" />
          <Toaster />
        </Router>
      </AppProvider>
    </ThemeProvider>
  );
}

export default App;
