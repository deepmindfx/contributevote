
import { ReactNode, useEffect } from 'react';
import { UserProvider } from './UserContext';
import { ContributionProvider } from './ContributionContext';
import { AdminProvider } from './AdminContext';
// AppProvider removed - now using SupabaseUserProvider and SupabaseContributionProvider
import { ensureAccountNumberDisplay } from '@/localStorage';
import { initializeLocalStorage } from '@/services/localStorage';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  // Initialize localStorage and ensure account numbers on app start
  useEffect(() => {
    try {
      // Initialize local storage
      initializeLocalStorage();
      
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
