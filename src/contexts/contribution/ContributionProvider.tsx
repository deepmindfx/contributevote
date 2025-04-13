
import { createContext, useContext, ReactNode } from 'react';
import { useUser } from '../UserContext';
import { useContributionState } from './hooks';
import { ContributionContextType } from './types';

const ContributionContext = createContext<ContributionContextType | undefined>(undefined);

export function ContributionProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, getUserByEmail, getUserByPhone } = useUser();
  const contributionState = useContributionState(user, isAuthenticated, getUserByEmail, getUserByPhone);

  return (
    <ContributionContext.Provider value={contributionState}>
      {children}
    </ContributionContext.Provider>
  );
}

export function useContribution() {
  const context = useContext(ContributionContext);
  if (context === undefined) {
    throw new Error('useContribution must be used within a ContributionProvider');
  }
  return context;
}
