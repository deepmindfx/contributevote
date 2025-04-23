
import { ReactNode } from 'react';
import { UserProvider } from './UserContext';
import { ContributionProvider } from './ContributionContext';
import { AdminProvider } from './AdminContext';
import { AppProvider } from './AppContext';
import { AuthProvider } from './AuthContext';
import { ensureAccountNumberDisplay } from '@/localStorage';
import { useEffect } from 'react';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  // Initialize localStorage but don't generate mock data
  useEffect(() => {
    try {
      // Make sure account numbers are displayed but don't generate mock data
      ensureAccountNumberDisplay();
      
      console.log("Initialized app providers");
    } catch (error) {
      console.error("Error initializing app providers:", error);
    }
  }, []);

  return (
    <AuthProvider>
      <UserProvider>
        <ContributionProvider>
          <AdminProvider>
            <AppProvider>
              {children}
            </AppProvider>
          </AdminProvider>
        </ContributionProvider>
      </UserProvider>
    </AuthProvider>
  );
}
