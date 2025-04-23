
import { ReactNode } from 'react';
import { UserProvider } from './UserContext';
import { ContributionProvider } from './ContributionContext';
import { AdminProvider } from './AdminContext';
import { AppProvider } from './AppContext';
import { ensureAccountNumberDisplay } from '@/localStorage';
import { useEffect } from 'react';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  // Initialize localStorage and ensure account numbers on app start
  useEffect(() => {
    try {
      // Make sure account numbers are displayed
      ensureAccountNumberDisplay();
      
      // Debug - log contributions to see account numbers
      console.log("Initialized app providers");
    } catch (error) {
      console.error("Error initializing app providers:", error);
    }
  }, []);

  return (
    <UserProvider>
      <ContributionProvider>
        <AdminProvider>
          <AppProvider>
            {children}
          </AppProvider>
        </AdminProvider>
      </ContributionProvider>
    </UserProvider>
  );
}
