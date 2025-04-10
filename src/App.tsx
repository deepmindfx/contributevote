
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from '@/contexts/AppContext';
import IndexPage from '@/pages/Index';
import AuthPage from '@/pages/Auth';
import Dashboard from '@/pages/Dashboard';
import GroupDetail from '@/pages/GroupDetail';  // Updated from Group
import ContributePage from '@/pages/ContributePage';  // Updated from Contribution
import VirtualAccount from '@/pages/VirtualAccount';
import UserSettings from '@/pages/UserSettings';  // Updated from Settings
import AdminAuth from '@/pages/AdminAuth';
import AdminDashboard from '@/pages/admin/Dashboard';
import UserProfile from '@/pages/UserProfile';  // Updated path
import ApiSettings from '@/pages/admin/ApiSettings';
import { Toaster } from "sonner";

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
          <Route path="/contribution/:contributionId" element={<ContributePage />} />
          <Route path="/virtual-account" element={<VirtualAccount />} />
          <Route path="/settings" element={<UserSettings />} />
        </Routes>
        <Toaster />
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;
