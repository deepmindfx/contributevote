
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from '@/contexts/AppContext';
import IndexPage from '@/pages/Index';
import AuthPage from '@/pages/Auth';
import Dashboard from '@/pages/Dashboard';
import GroupDetail from '@/pages/GroupDetail';
import ContributePage from '@/pages/ContributePage';
import VirtualAccount from '@/pages/VirtualAccount';
import UserSettings from '@/pages/UserSettings';
import AdminAuth from '@/pages/AdminAuth';
import AdminDashboard from '@/pages/admin/Dashboard';
import UserProfile from '@/pages/UserProfile';
import ApiSettings from '@/pages/admin/ApiSettings';
import { Toaster } from "sonner";
import AllGroups from '@/pages/AllGroups';
import CreateGroup from '@/pages/CreateGroup';
import Votes from '@/pages/Votes';
import WalletHistory from '@/pages/WalletHistory';
import ContributeSharePage from '@/pages/ContributeSharePage';
import NotFound from '@/pages/NotFound';

function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route path="/" element={<IndexPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/admin/auth" element={<AdminAuth />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users/:userId" element={<UserProfile />} />
          <Route path="/admin/api-settings" element={<ApiSettings />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/group/:groupId" element={<GroupDetail />} />
          <Route path="/groups/:groupId" element={<GroupDetail />} />
          <Route path="/contribution/:contributionId" element={<ContributePage />} />
          <Route path="/virtual-account" element={<VirtualAccount />} />
          <Route path="/settings" element={<UserSettings />} />
          <Route path="/all-groups" element={<AllGroups />} />
          <Route path="/create-group" element={<CreateGroup />} />
          <Route path="/votes" element={<Votes />} />
          <Route path="/wallet-history" element={<WalletHistory />} />
          <Route path="/share/:contributionId" element={<ContributeSharePage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;
