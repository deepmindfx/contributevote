
import { createContext, useContext, useState, useEffect } from 'react';
import { User, Contribution, Transaction, WithdrawalRequest } from '@/types';
import { 
  getUsers, 
  getUserByEmail, 
  getUserByPhone, 
  getContributions, 
  getUserContributions, 
  getTransactions, 
  contributeToGroup, 
  voteOnWithdrawalRequest, 
  getWithdrawalRequests,
  pingGroupMembersForVote,
  updateUser as updateUserStorage
} from '@/services/localStorage';

// Define the AppContext interface
interface AppContextProps {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  isAdmin: boolean;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
  createNewContribution: (contributionData: any) => void;
  updateUser: (userData: Partial<User>) => void;
  refreshUser: () => void;
  // Adding missing functions from TypeScript errors
  refreshData: () => void;
  updateProfile: (userData: Partial<User>) => void;
  users: User[];
  contributions: Contribution[];
  transactions: Transaction[];
  withdrawalRequests: WithdrawalRequest[];
  contribute: (contributionId: string, amount: number, anonymous?: boolean) => void;
  vote: (requestId: string, vote: 'approve' | 'reject') => void;
  pingMembersForVote: (requestId: string) => void;
  isGroupCreator: (contributionId: string) => boolean;
  getUserByEmail: (email: string) => User | null;
  getUserByPhone: (phone: string) => User | null;
  shareToContacts: (emails: string[], contributionId: string) => void;
}

// Create the AppContext
const AppContext = createContext<AppContextProps | undefined>(undefined);

// Create a custom hook to use the AppContext
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

// Create a provider component
export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    // Get user from localStorage on initialization
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  
  const [users, setUsers] = useState<User[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  
  const isAdmin = user?.role === 'admin';
  const isAuthenticated = !!user;
  
  // Fetch initial data
  useEffect(() => {
    if (isAuthenticated) {
      refreshData();
    }
  }, [isAuthenticated]);
  
  useEffect(() => {
    // Update localStorage when user changes
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);
  
  // Function to refresh all data
  const refreshData = () => {
    setUsers(getUsers());
    setContributions(getContributions());
    setTransactions(getTransactions());
    setWithdrawalRequests(getWithdrawalRequests());
  };
  
  // Function to update user in localStorage
  const updateUserInStorage = (updatedUser: User) => {
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };
  
  // Function to handle login
  const login = (user: User) => {
    setUser(user);
  };
  
  // Function to handle logout
  const logout = () => {
    setUser(null);
  };
  
  // Function to create a new contribution (dummy implementation)
  const createNewContribution = (contributionData: any) => {
    console.log('Creating new contribution:', contributionData);
    // Implement your logic here
  };

  // Fix the updateUser function to accept a partial user object
  const updateUser = (userData: Partial<User>) => {
    setUser(prevUser => {
      if (!prevUser) return null;
    
      // Merge existing user with new data, ensuring required properties exist
      const updatedUser = {
        ...prevUser,
        ...userData,
      };
    
      // Save to localStorage
      updateUserInStorage(updatedUser);
    
      // Return updated user
      return updatedUser;
    });
  };
  
  // Function to refresh user data from localStorage
  const refreshUser = () => {
    const storedUser = localStorage.getItem('user');
    setUser(storedUser ? JSON.parse(storedUser) : null);
  };
  
  // Alias for updateUser function
  const updateProfile = updateUser;
  
  // Function to contribute to a group
  const contribute = (contributionId: string, amount: number, anonymous: boolean = false) => {
    contributeToGroup(contributionId, amount, anonymous);
    refreshData();
  };
  
  // Function to vote on a withdrawal request
  const vote = (requestId: string, voteDecision: 'approve' | 'reject') => {
    voteOnWithdrawalRequest(requestId, voteDecision);
    refreshData();
  };
  
  // Function to ping members for vote
  const pingMembersForVote = (requestId: string) => {
    pingGroupMembersForVote(requestId);
  };
  
  // Function to check if the current user is the creator of a group
  const isGroupCreator = (contributionId: string) => {
    const contribution = contributions.find(c => c.id === contributionId);
    return contribution ? contribution.creatorId === user?.id : false;
  };
  
  // Function to share to contacts
  const shareToContacts = (emails: string[], contributionId: string) => {
    console.log('Sharing contribution to contacts:', emails, contributionId);
    // Implementation would go here
  };
  
  return (
    <AppContext.Provider value={{
      user,
      setUser,
      isAdmin,
      isAuthenticated,
      login,
      logout,
      createNewContribution,
      updateUser,
      refreshUser,
      refreshData,
      updateProfile,
      users,
      contributions,
      transactions,
      withdrawalRequests,
      contribute,
      vote,
      pingMembersForVote,
      isGroupCreator,
      getUserByEmail,
      getUserByPhone,
      shareToContacts,
    }}>
      {children}
    </AppContext.Provider>
  );
};
