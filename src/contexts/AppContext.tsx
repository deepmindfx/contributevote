
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User, 
  Contribution, 
  WithdrawalRequest, 
  Transaction,
  getCurrentUser,
  getContributions,
  getWithdrawalRequests,
  getTransactions,
  createContribution,
  contributeToGroup,
  createWithdrawalRequest,
  voteOnWithdrawalRequest,
  updateUserBalance,
  generateShareLink,
  initializeLocalStorage,
} from '@/services/localStorage';
import { toast } from 'sonner';

interface AppContextType {
  user: User;
  contributions: Contribution[];
  withdrawalRequests: WithdrawalRequest[];
  transactions: Transaction[];
  refreshData: () => void;
  createNewContribution: (contribution: Omit<Contribution, 'id' | 'createdAt' | 'currentAmount' | 'members'>) => void;
  contribute: (contributionId: string, amount: number) => void;
  requestWithdrawal: (request: Omit<WithdrawalRequest, 'id' | 'createdAt' | 'status' | 'votes'>) => void;
  vote: (requestId: string, vote: 'approve' | 'reject') => void;
  getShareLink: (contributionId: string) => string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>({} as User);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    initializeLocalStorage();
    refreshData();
  }, []);

  const refreshData = () => {
    setUser(getCurrentUser());
    setContributions(getContributions());
    setWithdrawalRequests(getWithdrawalRequests());
    setTransactions(getTransactions());
  };

  const createNewContribution = (contribution: Omit<Contribution, 'id' | 'createdAt' | 'currentAmount' | 'members'>) => {
    try {
      createContribution(contribution);
      refreshData();
      toast.success('Contribution group created successfully!');
    } catch (error) {
      toast.error('Failed to create contribution group');
      console.error(error);
    }
  };

  const contribute = (contributionId: string, amount: number) => {
    try {
      if (user.walletBalance < amount) {
        toast.error('Insufficient funds in your wallet');
        return;
      }
      
      contributeToGroup(contributionId, amount);
      refreshData();
      toast.success('Contribution successful!');
    } catch (error) {
      toast.error('Failed to make contribution');
      console.error(error);
    }
  };

  const requestWithdrawal = (request: Omit<WithdrawalRequest, 'id' | 'createdAt' | 'status' | 'votes'>) => {
    try {
      const contribution = contributions.find(c => c.id === request.contributionId);
      
      if (!contribution) {
        toast.error('Contribution not found');
        return;
      }
      
      if (contribution.currentAmount < request.amount) {
        toast.error('Requested amount exceeds available funds');
        return;
      }
      
      createWithdrawalRequest(request);
      refreshData();
      toast.success('Withdrawal request submitted for voting');
    } catch (error) {
      toast.error('Failed to create withdrawal request');
      console.error(error);
    }
  };

  const vote = (requestId: string, vote: 'approve' | 'reject') => {
    try {
      voteOnWithdrawalRequest(requestId, vote);
      refreshData();
      toast.success(`Vote ${vote === 'approve' ? 'approved' : 'rejected'} successfully`);
    } catch (error) {
      toast.error('Failed to submit vote');
      console.error(error);
    }
  };

  const getShareLink = (contributionId: string) => {
    return generateShareLink(contributionId);
  };

  return (
    <AppContext.Provider value={{
      user,
      contributions,
      withdrawalRequests,
      transactions,
      refreshData,
      createNewContribution,
      contribute,
      requestWithdrawal,
      vote,
      getShareLink,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
