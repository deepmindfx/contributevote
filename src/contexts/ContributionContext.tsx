
import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { 
  User, 
  Contribution, 
  WithdrawalRequest, 
  Transaction,
  Stats,
  getUserContributions,
  getWithdrawalRequests,
  getTransactions,
  getStatistics,
  createContribution,
  contributeToGroup,
  contributeByAccountNumber,
  createWithdrawalRequest,
  voteOnWithdrawalRequest,
  generateShareLink,
  addNotification,
  pingGroupMembersForVote,
  generateContributionReceipt,
  updateWithdrawalRequestsStatus,
  getContributionByAccountNumber
} from '@/services/localStorage';
import { toast } from 'sonner';
import { useUser } from './UserContext';

interface ContributionContextType {
  contributions: Contribution[];
  withdrawalRequests: WithdrawalRequest[];
  transactions: Transaction[];
  stats: Stats;
  refreshContributionData: () => void;
  createNewContribution: (contribution: Omit<Contribution, 'id' | 'createdAt' | 'currentAmount' | 'members' | 'contributors'>) => void;
  contribute: (contributionId: string, amount: number, anonymous?: boolean) => void;
  contributeViaAccountNumber: (accountNumber: string, amount: number, contributorInfo: { name: string, email?: string, phone?: string }, anonymous?: boolean) => void;
  requestWithdrawal: (request: Omit<WithdrawalRequest, 'id' | 'createdAt' | 'status' | 'votes' | 'deadline'>) => void;
  vote: (requestId: string, vote: 'approve' | 'reject') => void;
  getShareLink: (contributionId: string) => string;
  shareToContacts: (contributionId: string, recipients: string[]) => void;
  pingMembersForVote: (requestId: string) => void;
  getReceipt: (transactionId: string) => any;
  isGroupCreator: (contributionId: string) => boolean;
}

const ContributionContext = createContext<ContributionContextType | undefined>(undefined);

export function ContributionProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, getUserByEmail, getUserByPhone } = useUser();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats>({} as Stats);

  // New effect to check for expired withdrawal requests
  useEffect(() => {
    if (isAuthenticated) {
      const checkExpiredRequests = () => {
        updateWithdrawalRequestsStatus();
        refreshContributionData();
      };
      
      // Run once at start
      checkExpiredRequests();
      
      // Then set interval to check every minute
      const interval = setInterval(checkExpiredRequests, 60000);
      
      // Clear interval on unmount
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const refreshContributionData = () => {
    if (isAuthenticated && user?.id) {
      // Only get contributions for this user if authenticated
      setContributions(getUserContributions(user.id));
      setWithdrawalRequests(getWithdrawalRequests());
      setTransactions(getTransactions());
      setStats(getStatistics());
    } else {
      // Reset data if not authenticated
      setContributions([]);
      setWithdrawalRequests([]);
      setTransactions([]);
      setStats({} as Stats);
    }
  };

  const createNewContribution = (contribution: Omit<Contribution, 'id' | 'createdAt' | 'currentAmount' | 'members' | 'contributors'>) => {
    try {
      createContribution(contribution);
      refreshContributionData();
      toast.success('Contribution group created successfully!');
    } catch (error) {
      toast.error('Failed to create contribution group');
      console.error(error);
    }
  };

  const contribute = (contributionId: string, amount: number, anonymous: boolean = false) => {
    try {
      if (user.walletBalance < amount) {
        toast.error('Insufficient funds in your wallet');
        return;
      }
      
      contributeToGroup(contributionId, amount, anonymous);
      refreshContributionData();
      toast.success('Contribution successful!');
    } catch (error) {
      toast.error('Failed to make contribution');
      console.error(error);
    }
  };

  const contributeViaAccountNumber = (accountNumber: string, amount: number, contributorInfo: { name: string, email?: string, phone?: string }, anonymous: boolean = false) => {
    try {
      contributeByAccountNumber(accountNumber, amount, contributorInfo, anonymous);
      refreshContributionData();
      toast.success('Contribution successful!');
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Failed to make contribution');
      }
      console.error(error);
    }
  };

  const requestWithdrawal = (request: Omit<WithdrawalRequest, 'id' | 'createdAt' | 'status' | 'votes' | 'deadline'>) => {
    try {
      // Check if user has set up a PIN
      if (!user.pin) {
        toast.error('Please set up a transaction PIN in settings before requesting withdrawals');
        return;
      }
      
      const contribution = contributions.find(c => c.id === request.contributionId);
      
      if (!contribution) {
        toast.error('Contribution not found');
        return;
      }
      
      // Check if user is the creator of the group
      if (contribution.creatorId !== user.id) {
        toast.error('Only the group creator can request withdrawals');
        return;
      }
      
      if (contribution.currentAmount < request.amount) {
        toast.error('Requested amount exceeds available funds');
        return;
      }
      
      createWithdrawalRequest(request);
      refreshContributionData();
      toast.success('Withdrawal request submitted for voting');
    } catch (error) {
      toast.error('Failed to create withdrawal request');
      console.error(error);
    }
  };

  const vote = (requestId: string, vote: 'approve' | 'reject') => {
    try {
      // This now leverages the updated voteOnWithdrawalRequest function which checks for contribution eligibility
      voteOnWithdrawalRequest(requestId, vote);
      refreshContributionData();
      toast.success(`Vote ${vote === 'approve' ? 'approved' : 'rejected'} successfully`);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Failed to submit vote');
      }
      console.error(error);
    }
  };

  const getShareLink = (contributionId: string) => {
    return generateShareLink(contributionId);
  };
  
  const shareToContacts = (contributionId: string, recipients: string[]) => {
    try {
      const contribution = contributions.find(c => c.id === contributionId);
      
      if (!contribution) {
        toast.error('Contribution not found');
        return;
      }
      
      const shareUrl = `${window.location.origin}/contribute/share/${contributionId}`;
      
      // Log share event to console - in a real app we'd send actual notifications
      console.log(`Sharing contribution "${contribution.name}" to ${recipients.length} recipients`);
      console.log(`Share URL: ${shareUrl}`);
      console.log(`Recipients: ${recipients.join(', ')}`);
      
      // Process each recipient
      recipients.forEach(recipient => {
        // Check if recipient is an email or phone number
        let recipientUser = getUserByEmail(recipient);
        if (!recipientUser) {
          recipientUser = getUserByPhone(recipient);
        }
        
        if (recipientUser) {
          // Recipient is a registered user
          
          // Add notification to the recipient
          addNotification({
            userId: recipientUser.id,
            message: `${user.name} shared "${contribution.name}" contribution with you`,
            type: 'info',
            read: false,
            relatedId: contributionId,
          });
          
          // Add recipient to contribution members if not already there
          if (!contribution.members.includes(recipientUser.id)) {
            const contributions = getContributions();
            const contribIndex = contributions.findIndex(c => c.id === contributionId);
            
            if (contribIndex >= 0) {
              contributions[contribIndex].members.push(recipientUser.id);
              localStorage.setItem('contributions', JSON.stringify(contributions));
            }
          }
        } else {
          // Recipient is not a registered user
          // In a real app, we would send an invitation email/SMS
          console.log(`Recipient ${recipient} is not registered. Invitation would be sent.`);
        }
      });
      
      toast.success(`Contribution link shared with ${recipients.length} recipient(s)`);
      refreshContributionData();
    } catch (error) {
      toast.error('Failed to share contribution');
      console.error(error);
    }
  };
  
  const pingMembersForVote = (requestId: string) => {
    try {
      pingGroupMembersForVote(requestId);
      toast.success('Reminder sent to all members who have not voted yet');
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Failed to send reminders');
      }
      console.error(error);
    }
  };
  
  const getReceipt = (transactionId: string) => {
    try {
      const receipt = generateContributionReceipt(transactionId);
      if (!receipt) {
        toast.error('Unable to generate receipt for this transaction');
        return null;
      }
      return receipt;
    } catch (error) {
      toast.error('Failed to generate receipt');
      console.error(error);
      return null;
    }
  };
  
  const isGroupCreator = (contributionId: string): boolean => {
    const contribution = contributions.find(c => c.id === contributionId);
    return !!(contribution && contribution.creatorId === user.id);
  };

  return (
    <ContributionContext.Provider value={{
      contributions,
      withdrawalRequests,
      transactions,
      stats,
      refreshContributionData,
      createNewContribution,
      contribute,
      contributeViaAccountNumber,
      requestWithdrawal,
      vote,
      getShareLink,
      shareToContacts,
      pingMembersForVote,
      getReceipt,
      isGroupCreator,
    }}>
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

// Add a utility function to get contributions for import in the context
function getContributions() {
  try {
    const contributionsString = localStorage.getItem('contributions');
    return contributionsString ? JSON.parse(contributionsString) : [];
  } catch (error) {
    console.error("Error getting contributions:", error);
    return [];
  }
}
