
import { createContext, useContext, ReactNode } from 'react';
import { useUser } from './UserContext';
import { useContribution } from './ContributionContext';

interface AdminContextType {
  isAdmin: boolean;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const { isAdmin } = useUser();

  return (
    <AdminContext.Provider value={{
      isAdmin,
    }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}
