
import { ReactNode } from 'react';
import { UserProvider } from './UserContext';
import { ContributionProvider } from './ContributionContext';
import { AdminProvider } from './AdminContext';
import { ensureAccountNumberDisplay } from '@/localStorage';
import { useEffect } from 'react';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  // Initialize localStorage and ensure account numbers on app start
  useEffect(() => {
    // Make sure account numbers are displayed
    ensureAccountNumberDisplay();
    
    // Debug - log contributions to see account numbers
    console.log("Initialized app providers");
  }, []);

  return (
    <UserProvider>
      <ContributionProvider>
        <AdminProvider>
          {children}
        </AdminProvider>
      </ContributionProvider>
    </UserProvider>
  );
}
