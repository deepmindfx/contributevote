import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User, 
  Contribution, 
  WithdrawalRequest, 
  Transaction,
  Stats,
  getCurrentUser,
  getContributions,
  getUserContributions,
  getWithdrawalRequests,
  getTransactions,
  getUsers,
  getStatistics,
  createContribution,
  contributeToGroup,
  contributeByAccountNumber,
  createWithdrawalRequest,
  voteOnWithdrawalRequest,
  updateUserBalance,
  generateShareLink,
  initializeLocalStorage,
  updateUser,
  updateUserById,
  pauseUser,
  activateUser,
  depositToUser,
  logoutUser,
  addNotification,
  getUserByEmail,
  getUserByPhone,
  pingGroupMembersForVote,
  generateContributionReceipt,
  updateWithdrawalRequestsStatus,
  verifyUserWithOTP,
  getContributionByAccountNumber,
  generateOTP,
  storeOTP,
  verifyOTP,
  updateUserVirtualAccount,
  updateUserKYC
} from '@/services/localStorage';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { sendOTPEmail, sendWithdrawalReminderEmail } from '@/services/emailService';
import { monnifyAPI } from '@/services/monnifyService';
import { 
  sendOTPSMS, 
  generateOTP, 
  storeOTP, 
  verifyOTP 
} from '@/services/smsBulkService';

interface AppContextType {
  user: User;
  users: User[];
  contributions: Contribution[];
  withdrawalRequests: WithdrawalRequest[];
  transactions: Transaction[];
  stats: Stats;
  refreshData: () => void;
  createNewContribution: (contribution: Omit<Contribution, 'id' | 'createdAt' | 'currentAmount' | 'members' | 'contributors' | 'accountNumber'>) => void;
  contribute: (contributionId: string, amount: number, anonymous?: boolean) => void;
  contributeViaAccountNumber: (accountNumber: string, amount: number, contributorInfo: { name: string, email?: string, phone?: string }, anonymous?: boolean) => void;
  requestWithdrawal: (request: Omit<WithdrawalRequest, 'id' | 'createdAt' | 'status' | 'votes' | 'deadline'>) => void;
  vote: (requestId: string, vote: 'approve' | 'reject') => void;
  getShareLink: (contributionId: string) => string;
  updateProfile: (userData: Partial<User>) => void;
  updateUserAsAdmin: (userId: string, userData: Partial<User>) => void;
  depositToUserAsAdmin: (userId: string, amount: number) => void;
  pauseUserAsAdmin: (userId: string) => void;
  activateUserAsAdmin: (userId: string) => void;
  isAdmin: boolean;
  isAuthenticated: boolean;
  shareToContacts: (contributionId: string, recipients: string[]) => void;
  logout: () => void;
  getUserByEmail: (email: string) => User | null;
  getUserByPhone: (phone: string) => User | null;
  pingMembersForVote: (requestId: string) => void;
  getReceipt: (transactionId: string) => any;
  verifyUser: (userId: string) => void;
  isGroupCreator: (contributionId: string) => boolean;
  sendVerificationEmail: (userId: string, email: string) => Promise<boolean>;
  verifyUserWithOTPCode: (userId: string, otp: string) => boolean;
  createVirtualAccount: () => Promise<boolean>;
  updateKYCDetails: (kycData: { bvn?: string; nin?: string }) => Promise<boolean>;
  initiateTransfer: (params: { amount: number; recipientAccountNumber: string; recipientBankCode: string; recipientName: string; narration: string }) => Promise<boolean>;
  getVirtualAccountTransactions: () => Promise<any[]>;
  getSupportedBanks: () => Promise<{ bankCode: string; bankName: string }[]>;
  sendVerificationSMS: (userId: string, phone: string) => Promise<boolean>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>({} as User);
  const [users, setUsers] = useState<User[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats>({} as Stats);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  useEffect(() => {
    if (user?.preferences?.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [user?.preferences?.darkMode]);

  useEffect(() => {
    initializeLocalStorage();
    refreshData();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      const checkExpiredRequests = () => {
        updateWithdrawalRequestsStatus();
        refreshData();
      };
      
      checkExpiredRequests();
      
      const interval = setInterval(checkExpiredRequests, 60000);
      
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const refreshData = () => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
    setUsers(getUsers());
    
    const isUserAuthenticated = !!currentUser && !!currentUser.id;
    setIsAuthenticated(isUserAuthenticated);
    
    if (isUserAuthenticated) {
      setContributions(getUserContributions(currentUser.id));
      setWithdrawalRequests(getWithdrawalRequests());
      setTransactions(getTransactions());
      setStats(getStatistics());
      setIsAdmin(currentUser?.role === 'admin');
    } else {
      setContributions([]);
      setWithdrawalRequests([]);
      setTransactions([]);
      setStats({} as Stats);
      setIsAdmin(false);
    }
  };

  const logout = () => {
    logoutUser();
    refreshData();
    toast.success("You have been logged out successfully");
  };

  const createNewContribution = (contribution: Omit<Contribution, 'id' | 'createdAt' | 'currentAmount' | 'members' | 'contributors' | 'accountNumber'>) => {
    try {
      createContribution(contribution);
      refreshData();
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
      refreshData();
      toast.success('Contribution successful!');
    } catch (error) {
      toast.error('Failed to make contribution');
      console.error(error);
    }
  };

  const contributeViaAccountNumber = (accountNumber: string, amount: number, contributorInfo: { name: string, email?: string, phone?: string }, anonymous: boolean = false) => {
    try {
      contributeByAccountNumber(accountNumber, amount, contributorInfo, anonymous);
      refreshData();
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
      if (!user.pin) {
        toast.error('Please set up a transaction PIN in settings before requesting withdrawals');
        return;
      }
      
      const contribution = contributions.find(c => c.id === request.contributionId);
      
      if (!contribution) {
        toast.error('Contribution not found');
        return;
      }
      
      if (contribution.creatorId !== user.id) {
        toast.error('Only the group creator can request withdrawals');
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
  
  const updateProfile = (userData: Partial<User>) => {
    try {
      updateUser(userData);
      refreshData();
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
      console.error(error);
    }
  };

  const updateUserAsAdmin = (userId: string, userData: Partial<User>) => {
    try {
      if (!isAdmin) {
        toast.error('Unauthorized access');
        return;
      }

      updateUserById(userId, userData);
      refreshData();
      toast.success('User updated successfully');
    } catch (error) {
      toast.error('Failed to update user');
      console.error(error);
    }
  };

  const depositToUserAsAdmin = (userId: string, amount: number) => {
    try {
      if (!isAdmin) {
        toast.error('Unauthorized access');
        return;
      }

      depositToUser(userId, amount);
      refreshData();
      toast.success(`Successfully deposited ₦${amount.toLocaleString()} to user`);
    } catch (error) {
      toast.error('Failed to deposit funds');
      console.error(error);
    }
  };

  const pauseUserAsAdmin = (userId: string) => {
    try {
      if (!isAdmin) {
        toast.error('Unauthorized access');
        return;
      }

      pauseUser(userId);
      refreshData();
      toast.success('User paused successfully');
    } catch (error) {
      toast.error('Failed to pause user');
      console.error(error);
    }
  };

  const activateUserAsAdmin = (userId: string) => {
    try {
      if (!isAdmin) {
        toast.error('Unauthorized access');
        return;
      }

      activateUser(userId);
      refreshData();
      toast.success('User activated successfully');
    } catch (error) {
      toast.error('Failed to activate user');
      console.error(error);
    }
  };
  
  const shareToContacts = (contributionId: string, recipients: string[]) => {
    try {
      const currentUser = getCurrentUser();
      const contribution = contributions.find(c => c.id === contributionId);
      
      if (!contribution) {
        toast.error('Contribution not found');
        return;
      }
      
      const shareUrl = `${window.location.origin}/contribute/share/${contributionId}`;
      const allUsers = getUsers();
      
      console.log(`Sharing contribution "${contribution.name}" to ${recipients.length} recipients`);
      console.log(`Share URL: ${shareUrl}`);
      console.log(`Recipients: ${recipients.join(', ')}`);
      
      recipients.forEach(recipient => {
        let recipientUser = getUserByEmail(recipient);
        if (!recipientUser) {
          recipientUser = getUserByPhone(recipient);
        }
        
        if (recipientUser) {
          
          addNotification({
            userId: recipientUser.id,
            message: `${currentUser.name} shared "${contribution.name}" contribution with you`,
            type: 'info',
            read: false,
            relatedId: contributionId,
          });
          
          if (!contribution.members.includes(recipientUser.id)) {
            const contributions = getContributions();
            const contribIndex = contributions.findIndex(c => c.id === contributionId);
            
            if (contribIndex >= 0) {
              contributions[contribIndex].members.push(recipientUser.id);
              localStorage.setItem('contributions', JSON.stringify(contributions));
            }
          }
        } else {
          console.log(`Recipient ${recipient} is not registered. Invitation would be sent.`);
        }
      });
      
      toast.success(`Contribution link shared with ${recipients.length} recipient(s)`);
      refreshData();
    } catch (error) {
      toast.error('Failed to share contribution');
      console.error(error);
    }
  };
  
  const pingMembersForVote = (requestId: string) => {
    try {
      const withdrawalRequests = getWithdrawalRequests();
      const request = withdrawalRequests.find(r => r.id === requestId);
      
      if (!request) {
        toast.error('Withdrawal request not found');
        return;
      }
      
      const contributions = getContributions();
      const contribution = contributions.find(c => c.id === request.contributionId);
      
      if (!contribution) {
        toast.error('Contribution not found');
        return;
      }
      
      const requester = users.find(u => u.id === request.requesterId);
      const requesterName = requester ? requester.name : 'Unknown user';
      
      pingGroupMembersForVote(requestId);
      
      const nonVotingMembers = contribution.members.filter(memberId => {
        const hasVoted = request.votes.some(vote => vote.userId === memberId);
        return !hasVoted && memberId !== request.requesterId;
      });
      
      nonVotingMembers.forEach(async (memberId) => {
        const member = users.find(u => u.id === memberId);
        if (member && member.email) {
          await sendWithdrawalReminderEmail(
            member.email,
            { amount: request.amount, purpose: request.purpose },
            contribution.name,
            requesterName,
            requestId
          );
        }
      });
      
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
  
  const verifyUser = (userId: string) => {
    try {
      verifyUserWithOTP(userId);
      refreshData();
      toast.success('User verified successfully');
    } catch (error) {
      toast.error('Failed to verify user');
      console.error(error);
    }
  };
  
  const isGroupCreator = (contributionId: string): boolean => {
    const contribution = contributions.find(c => c.id === contributionId);
    return !!(contribution && contribution.creatorId === user.id);
  };

  const sendVerificationEmail = async (userId: string, email: string): Promise<boolean> => {
    try {
      const otp = generateOTP();
      
      storeOTP(userId, otp);
      
      const result = await sendOTPEmail(email, otp);
      
      if (result.success) {
        toast.success('Verification email sent! Please check your inbox.');
        return true;
      } else {
        toast.error('Failed to send verification email. Please try again.');
        return false;
      }
    } catch (error) {
      console.error('Error sending verification email:', error);
      toast.error('Failed to send verification email');
      return false;
    }
  };
  
  const verifyUserWithOTPCode = (userId: string, otp: string): boolean => {
    const isValid = verifyOTP(userId, otp);
    
    if (isValid) {
      toast.success('Account verified successfully!');
      refreshData();
    } else {
      toast.error('Invalid or expired OTP. Please try again.');
    }
    
    return isValid;
  };

  const createVirtualAccount = async (): Promise<boolean> => {
    try {
      if (!isAuthenticated) {
        toast.error('You must be logged in to create a virtual account');
        return false;
      }
      
      if (user.virtualAccount) {
        toast.info('You already have a virtual account');
        return true;
      }
      
      toast.loading('Creating your virtual account...');
      
      const virtualAccount = await monnifyAPI.createVirtualAccount({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        bvn: user.bvn,
        nin: user.nin
      });
      
      const accountDetails = virtualAccount.accounts[0];
      
      updateUserVirtualAccount(user.id, {
        accountNumber: accountDetails.accountNumber,
        bankName: accountDetails.bankName,
        bankCode: accountDetails.bankCode,
        reference: virtualAccount.accountReference,
        reservationReference: virtualAccount.reservationReference
      });
      
      refreshData();
      
      toast.dismiss();
      toast.success('Virtual account created successfully');
      
      addNotification({
        userId: user.id,
        message: `Your virtual account (${accountDetails.bankName}: ${accountDetails.accountNumber}) has been created successfully.`,
        type: 'success',
        read: false
      });
      
      return true;
    } catch (error) {
      toast.dismiss();
      console.error('Error creating virtual account:', error);
      toast.error('Failed to create virtual account. Please try again later.');
      return false;
    }
  };
  
  const updateKYCDetails = async (kycData: { bvn?: string; nin?: string }): Promise<boolean> => {
    try {
      if (!isAuthenticated) {
        toast.error('You must be logged in to update KYC details');
        return false;
      }
      
      if (!kycData.bvn && !kycData.nin) {
        toast.error('Please provide either BVN or NIN');
        return false;
      }
      
      updateUserKYC(user.id, kycData);
      
      refreshData();
      
      toast.success('KYC details updated successfully');
      
      return true;
    } catch (error) {
      console.error('Error updating KYC details:', error);
      toast.error('Failed to update KYC details. Please try again later.');
      return false;
    }
  };
  
  const initiateTransfer = async (params: { 
    amount: number; 
    recipientAccountNumber: string; 
    recipientBankCode: string; 
    recipientName: string; 
    narration: string 
  }): Promise<boolean> => {
    try {
      if (!isAuthenticated) {
        toast.error('You must be logged in to initiate a transfer');
        return false;
      }
      
      if (user.walletBalance < params.amount) {
        toast.error('Insufficient funds in your wallet');
        return false;
      }
      
      toast.loading('Processing transfer...');
      
      const reference = `transfer_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      
      const result = await monnifyAPI.initiateTransfer({
        ...params,
        reference
      });
      
      updateUserBalance(-params.amount);
      
      recordTransaction({
        userId: user.id,
        contributionId: '',
        type: 'withdrawal',
        amount: params.amount,
        description: `Transfer to ${params.recipientName} (${params.recipientAccountNumber}) - ${params.narration}`
      });
      
      refreshData();
      
      toast.dismiss();
      toast.success('Transfer initiated successfully');
      
      return true;
    } catch (error) {
      toast.dismiss();
      console.error('Error initiating transfer:', error);
      toast.error('Failed to initiate transfer. Please try again later.');
      return false;
    }
  };
  
  const getVirtualAccountTransactions = async (): Promise<any[]> => {
    try {
      if (!isAuthenticated) {
        toast.error('You must be logged in to view transactions');
        return [];
      }
      
      if (!user.virtualAccount) {
        toast.info('You do not have a virtual account yet');
        return [];
      }
      
      const transactions = await monnifyAPI.getTransactions(user.virtualAccount.reference);
      
      return transactions;
    } catch (error) {
      console.error('Error fetching virtual account transactions:', error);
      toast.error('Failed to fetch transactions. Please try again later.');
      return [];
    }
  };
  
  const getSupportedBanks = async (): Promise<{ bankCode: string; bankName: string }[]> => {
    try {
      const banks = await monnifyAPI.getBanks();
      return banks;
    } catch (error) {
      console.error('Error fetching supported banks:', error);
      toast.error('Failed to fetch supported banks. Please try again later.');
      return [];
    }
  };
  
  const recordTransaction = (transaction: Omit<Transaction, 'id' | 'createdAt' | 'status'>) => {
    const transactions = getTransactions();
    const newTransaction: Transaction = {
      id: Math.random().toString(36).substring(2, 15),
      ...transaction,
      createdAt: new Date().toISOString(),
      status: 'completed'
    };
    
    transactions.push(newTransaction);
    localStorage.setItem('transactions', JSON.stringify(transactions));
  };

  const sendVerificationSMS = async (userId: string, phone: string): Promise<boolean> => {
    try {
      const otp = generateOTP();
      
      storeOTP(userId, otp);
      
      const result = await sendOTPSMS(phone, otp);
      
      if (result) {
        toast.success('Verification code sent! Please check your phone.');
        return true;
      } else {
        toast.error('Failed to send verification code. Please try again.');
        return false;
      }
    } catch (error) {
      console.error('Error sending verification SMS:', error);
      toast.error('Failed to send verification SMS');
      return false;
    }
  };

  return (
    <AppContext.Provider value={{
      user,
      users,
      contributions,
      withdrawalRequests,
      transactions,
      stats,
      refreshData,
      createNewContribution,
      contribute,
      contributeViaAccountNumber,
      requestWithdrawal,
      vote,
      getShareLink,
      updateProfile,
      updateUserAsAdmin,
      depositToUserAsAdmin,
      pauseUserAsAdmin,
      activateUserAsAdmin,
      isAdmin,
      isAuthenticated,
      shareToContacts,
      logout,
      getUserByEmail,
      getUserByPhone,
      pingMembersForVote,
      getReceipt,
      verifyUser,
      isGroupCreator,
      sendVerificationEmail,
      verifyUserWithOTPCode,
      createVirtualAccount,
      updateKYCDetails,
      initiateTransfer,
      getVirtualAccountTransactions,
      getSupportedBanks,
      sendVerificationSMS
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
