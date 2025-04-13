import { isValid } from "date-fns";
import { ReservedAccountData, CardTokenData } from "@/services/walletIntegration";

// Define interfaces
export interface User {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  username?: string;
  password: string;
  role?: 'user' | 'admin';
  status?: 'active' | 'paused';
  walletBalance: number;
  createdAt: string;
  profileImage?: string;
  pin?: string;
  verified?: boolean;
  bvn?: string;
  reservedAccount?: ReservedAccountData;
  cardTokens?: CardTokenData[];
  invoices?: InvoiceData[];
  preferences?: {
    darkMode: boolean;
    anonymousContributions: boolean;
    notificationsEnabled: boolean;
  };
  notifications?: Notification[];
}

// Add interface for invoice data
export interface InvoiceData {
  invoiceReference: string;
  amount: number;
  description: string;
  currencyCode: string;
  customerEmail: string;
  customerName: string;
  status: string;
  createdAt: string;
  expiryDate: string;
  checkoutUrl?: string;
  contributionId?: string;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  read: boolean;
  createdAt: string;
  relatedId?: string;
}

export interface Contribution {
  id: string;
  name: string;
  description: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  createdAt: string;
  creatorId: string;
  members: string[];
  contributors: Array<{
    userId: string;
    amount: number;
    date: string;
    anonymous: boolean;
  }>;
  category: string;
  visibility: 'public' | 'private' | 'invite-only';
  status: 'active' | 'completed' | 'expired';
  accountNumber?: string;
  bankName?: string;
  accountReference?: string;
  accountDetails?: any;
  // Additional properties for the enhanced group features
  frequency?: 'daily' | 'weekly' | 'monthly' | 'one-time';
  contributionAmount?: number;
  startDate?: string;
  endDate?: string;
  votingThreshold?: number;
  privacy?: 'public' | 'private';
  memberRoles?: 'equal' | 'weighted';
}

export interface WithdrawalRequest {
  id: string;
  contributionId: string;
  amount: number;
  reason: string;
  beneficiary: string;
  accountNumber: string;
  bankName: string;
  createdAt: string;
  deadline: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  votes: Array<{
    userId: string;
    vote: 'approve' | 'reject';
    date: string;
  }>;
  purpose?: string; // For compatibility with existing code
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'deposit' | 'withdrawal' | 'transfer' | 'vote';
  amount: number;
  contributionId: string;
  description: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  metaData?: Record<string, any>;
  anonymous?: boolean;
}

export interface Stats {
  totalUsers: number;
  totalContributions: number;
  totalTransactions: number;
  totalAmountContributed: number;
  totalAmount?: number;
  activeRequests?: number;
  totalWithdrawals?: number;
}

// Helper functions
export const getCurrentUser = (): User => {
  const currentUserJson = localStorage.getItem('currentUser');
  if (currentUserJson) {
    return JSON.parse(currentUserJson);
  }
  return {} as User;
};

export const getUsers = (): User[] => {
  const usersJson = localStorage.getItem('users');
  if (usersJson) {
    return JSON.parse(usersJson);
  }
  return [];
};

export const updateUser = (userData: Partial<User>): void => {
  const currentUser = getCurrentUser();
  const updatedUser = { ...currentUser, ...userData };
  localStorage.setItem('currentUser', JSON.stringify(updatedUser));
  
  // Also update the user in the users array
  const users = getUsers();
  const index = users.findIndex(u => u.id === currentUser.id);
  if (index >= 0) {
    users[index] = updatedUser;
    localStorage.setItem('users', JSON.stringify(users));
  }
};

export const updateUserBalance = (amount: number): void => {
  const currentUser = getCurrentUser();
  const newBalance = (currentUser.walletBalance || 0) + amount;
  updateUser({
    walletBalance: newBalance
  });
};

export const getUserContributions = (userId: string): Contribution[] => {
  const contributions = getContributions();
  return contributions.filter(c => 
    c.creatorId === userId || 
    c.members.includes(userId) || 
    c.contributors.some(contrib => contrib.userId === userId)
  );
};

export const getContributions = (): Contribution[] => {
  const contributionsJson = localStorage.getItem('contributions');
  if (contributionsJson) {
    return JSON.parse(contributionsJson);
  }
  return [];
};

export const getTransactions = (): Transaction[] => {
  const transactionsJson = localStorage.getItem('transactions');
  if (transactionsJson) {
    return JSON.parse(transactionsJson);
  }
  return [];
};

export const addTransaction = (transaction: Transaction): void => {
  const transactions = getTransactions();
  transactions.push(transaction);
  localStorage.setItem('transactions', JSON.stringify(transactions));
};

// Add the missing function to localStorage.ts
export const verifyUserWithOTP = (userId: string): void => {
  try {
    const users = getUsers();
    const index = users.findIndex(u => u.id === userId);
    
    if (index >= 0) {
      users[index].verified = true;
      localStorage.setItem('users', JSON.stringify(users));
      
      // If this is the current user, update that too
      const currentUser = getCurrentUser();
      if (currentUser && currentUser.id === userId) {
        currentUser.verified = true;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
      }
    }
  } catch (error) {
    console.error("Error in verifyUserWithOTP:", error);
  }
};

// Helper to validate dates
export const validateDate = (dateString: string): boolean => {
  if (!dateString) return false;
  
  try {
    const date = new Date(dateString);
    return isValid(date);
  } catch (error) {
    console.error("Error validating date:", error);
    return false;
  }
};

// Add more functions based on what's imported elsewhere
export const getWithdrawalRequests = (): WithdrawalRequest[] => {
  const requestsJson = localStorage.getItem('withdrawalRequests');
  if (requestsJson) {
    return JSON.parse(requestsJson);
  }
  return [];
};

export const getStatistics = (): Stats => {
  // In a real app, calculate this from real data
  const users = getUsers();
  const contributions = getContributions();
  const transactions = getTransactions();
  
  return {
    totalUsers: users.length,
    totalContributions: contributions.length,
    totalTransactions: transactions.length,
    totalAmountContributed: transactions
      .filter(t => t.type === 'deposit')
      .reduce((sum, t) => sum + t.amount, 0)
  };
};

export const updateUserById = (userId: string, userData: Partial<User>): void => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === userId);
  
  if (index >= 0) {
    users[index] = { ...users[index], ...userData };
    localStorage.setItem('users', JSON.stringify(users));
    
    // If this is the current user, update that too
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      localStorage.setItem('currentUser', JSON.stringify({ ...currentUser, ...userData }));
    }
  }
};

export const createContribution = (contribution: Omit<Contribution, 'id' | 'createdAt' | 'currentAmount' | 'members' | 'contributors'>): void => {
  const contributions = getContributions();
  const currentUser = getCurrentUser();
  
  const newContribution: Contribution = {
    id: `c_${Date.now()}`,
    createdAt: new Date().toISOString(),
    currentAmount: 0,
    members: [currentUser.id],
    contributors: [],
    ...contribution,
    // If accountNumber is not provided, generate a dummy one like before
    accountNumber: contribution.accountNumber || `${10000000 + contributions.length}`,
  };
  
  contributions.push(newContribution);
  localStorage.setItem('contributions', JSON.stringify(contributions));
};

export const contributeToGroup = (contributionId: string, amount: number, anonymous: boolean = false): void => {
  const contributions = getContributions();
  const index = contributions.findIndex(c => c.id === contributionId);
  
  if (index >= 0) {
    const currentUser = getCurrentUser();
    
    // Check if user has enough balance
    if (currentUser.walletBalance < amount) {
      throw new Error("Insufficient funds");
    }
    
    // Update contribution
    contributions[index].currentAmount += amount;
    contributions[index].contributors.push({
      userId: currentUser.id,
      amount,
      date: new Date().toISOString(),
      anonymous
    });
    
    // Ensure user is a member
    if (!contributions[index].members.includes(currentUser.id)) {
      contributions[index].members.push(currentUser.id);
    }
    
    // Add transaction
    addTransaction({
      id: `t_${Date.now()}`,
      userId: currentUser.id,
      type: 'deposit',
      amount,
      contributionId,
      description: `Contribution to ${contributions[index].name}`,
      status: 'completed',
      createdAt: new Date().toISOString()
    });
    
    // Update user balance
    updateUserBalance(-amount);
    
    // Save updated contributions
    localStorage.setItem('contributions', JSON.stringify(contributions));
  } else {
    throw new Error("Contribution not found");
  }
};

export const contributeByAccountNumber = (accountNumber: string, amount: number, contributorInfo: { name: string, email?: string, phone?: string }, anonymous: boolean = false): void => {
  const contributions = getContributions();
  const index = contributions.findIndex(c => c.accountNumber === accountNumber);
  
  if (index < 0) {
    throw new Error("Invalid account number");
  }
  
  // Update contribution
  contributions[index].currentAmount += amount;
  
  // Since this could be an external contributor, create a placeholder ID
  const externalUserId = `external_${Date.now()}`;
  
  contributions[index].contributors.push({
    userId: externalUserId,
    amount,
    date: new Date().toISOString(),
    anonymous
  });
  
  // Add transaction with detailed metadata
  addTransaction({
    id: `t_${Date.now()}`,
    userId: externalUserId,
    type: 'deposit',
    amount,
    contributionId: contributions[index].id,
    description: `External contribution to ${contributions[index].name} by ${contributorInfo.name}`,
    status: 'completed',
    createdAt: new Date().toISOString(),
    metaData: {
      contributorName: contributorInfo.name,
      contributorEmail: contributorInfo.email,
      contributorPhone: contributorInfo.phone,
      senderName: contributorInfo.name,
      bankName: contributorInfo.email ? `via ${contributorInfo.email}` : undefined,
      senderBank: contributorInfo.email ? `via ${contributorInfo.email}` : undefined
    },
    anonymous
  });
  
  // Save updated contributions
  localStorage.setItem('contributions', JSON.stringify(contributions));
};

export const getContributionByAccountNumber = (accountNumber: string): Contribution | null => {
  const contributions = getContributions();
  const contribution = contributions.find(c => c.accountNumber === accountNumber);
  return contribution || null;
};

export const createWithdrawalRequest = (request: Omit<WithdrawalRequest, 'id' | 'createdAt' | 'status' | 'votes' | 'deadline'>): void => {
  const requests = getWithdrawalRequests();
  const newRequest: WithdrawalRequest = {
    id: `wr_${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: 'pending',
    votes: [],
    deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
    ...request
  };
  
  requests.push(newRequest);
  localStorage.setItem('withdrawalRequests', JSON.stringify(requests));
};

export const voteOnWithdrawalRequest = (requestId: string, vote: 'approve' | 'reject'): void => {
  const requests = getWithdrawalRequests();
  const requestIndex = requests.findIndex(r => r.id === requestId);
  
  if (requestIndex < 0) {
    throw new Error("Withdrawal request not found");
  }
  
  const request = requests[requestIndex];
  
  if (request.status !== 'pending') {
    throw new Error(`This request is already ${request.status}`);
  }
  
  // Check if deadline has passed
  if (new Date() > new Date(request.deadline)) {
    throw new Error("Voting deadline has passed");
  }
  
  const currentUser = getCurrentUser();
  
  // Check if user has already voted
  const existingVoteIndex = request.votes.findIndex(v => v.userId === currentUser.id);
  
  if (existingVoteIndex >= 0) {
    // Update existing vote
    request.votes[existingVoteIndex] = {
      userId: currentUser.id,
      vote,
      date: new Date().toISOString()
    };
  } else {
    // Add new vote
    request.votes.push({
      userId: currentUser.id,
      vote,
      date: new Date().toISOString()
    });
  }
  
  // Check if vote threshold reached
  const contribution = getContributions().find(c => c.id === request.contributionId);
  
  if (!contribution) {
    throw new Error("Related contribution not found");
  }
  
  // Calculate required votes
  const totalMembers = contribution.members.length;
  const requiredVotes = Math.max(Math.ceil(totalMembers / 2), 2); // At least 2 votes or majority
  
  const approveVotes = request.votes.filter(v => v.vote === 'approve').length;
  const rejectVotes = request.votes.filter(v => v.vote === 'reject').length;
  
  // Update request status if threshold reached
  if (approveVotes >= requiredVotes) {
    request.status = 'approved';
    
    // Create transaction
    addTransaction({
      id: `t_${Date.now()}`,
      userId: currentUser.id,
      type: 'withdrawal',
      amount: request.amount,
      contributionId: request.contributionId,
      description: `Withdrawal from ${contribution.name} - ${request.reason}`,
      status: 'completed',
      createdAt: new Date().toISOString(),
      metaData: {
        beneficiary: request.beneficiary,
        accountNumber: request.accountNumber,
        bankName: request.bankName
      }
    });
    
    // Update contribution amount
    const contributions = getContributions();
    const contributionIndex = contributions.findIndex(c => c.id === request.contributionId);
    
    if (contributionIndex >= 0) {
      contributions[contributionIndex].currentAmount -= request.amount;
      localStorage.setItem('contributions', JSON.stringify(contributions));
    }
  } else if (rejectVotes >= requiredVotes) {
    request.status = 'rejected';
  }
  
  // Save updated requests
  localStorage.setItem('withdrawalRequests', JSON.stringify(requests));
  
  // Add transaction for the vote
  addTransaction({
    id: `t_${Date.now()}`,
    userId: currentUser.id,
    type: 'vote',
    amount: 0,
    contributionId: request.contributionId,
    description: `Voted to ${vote} withdrawal request for ${contribution.name}`,
    status: 'completed',
    createdAt: new Date().toISOString()
  });
};

export const hasContributed = (contributionId: string, userId: string): boolean => {
  const contributions = getContributions();
  const contribution = contributions.find(c => c.id === contributionId);
  
  if (!contribution) return false;
  
  return contribution.contributors.some(c => c.userId === userId);
};

export const generateShareLink = (contributionId: string): string => {
  return `${window.location.origin}/contribute/share/${contributionId}`;
};

export const initializeLocalStorage = (): void => {
  // Only initialize if not already done
  if (!localStorage.getItem('initialized')) {
    localStorage.setItem('users', JSON.stringify([]));
    localStorage.setItem('contributions', JSON.stringify([]));
    localStorage.setItem('withdrawalRequests', JSON.stringify([]));
    localStorage.setItem('transactions', JSON.stringify([]));
    localStorage.setItem('initialized', 'true');
  }
};

export const pauseUser = (userId: string): void => {
  updateUserById(userId, { status: 'paused' });
};

export const activateUser = (userId: string): void => {
  updateUserById(userId, { status: 'active' });
};

export const depositToUser = (userId: string, amount: number): void => {
  const users = getUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex >= 0) {
    const user = users[userIndex];
    users[userIndex] = {
      ...user,
      walletBalance: (user.walletBalance || 0) + amount
    };
    
    localStorage.setItem('users', JSON.stringify(users));
    
    // Add transaction record
    addTransaction({
      id: `t_${Date.now()}`,
      userId,
      type: 'deposit',
      amount,
      contributionId: '',
      description: 'Admin deposit',
      status: 'completed',
      createdAt: new Date().toISOString()
    });
    
    // Update current user if needed
    const currentUser = getCurrentUser();
    if (currentUser.id === userId) {
      updateUser({
        walletBalance: (currentUser.walletBalance || 0) + amount
      });
    }
  }
};

export const logoutUser = (): void => {
  localStorage.removeItem('currentUser');
};

export const addNotification = (notification: Omit<Notification, 'id' | 'createdAt'>): void => {
  const userId = notification.userId;
  const users = getUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex >= 0) {
    const user = users[userIndex];
    const notifications = user.notifications || [];
    
    notifications.push({
      ...notification,
      id: `n_${Date.now()}`,
      createdAt: new Date().toISOString()
    });
    
    users[userIndex] = {
      ...user,
      notifications
    };
    
    localStorage.setItem('users', JSON.stringify(users));
    
    // Update current user if needed
    const currentUser = getCurrentUser();
    if (currentUser.id === userId) {
      updateUser({
        notifications
      });
    }
  }
};

export const getUserByEmail = (email: string): User | null => {
  const users = getUsers();
  const user = users.find(u => u.email === email);
  return user || null;
};

export const getUserByPhone = (phone: string): User | null => {
  const users = getUsers();
  const user = users.find(u => u.phoneNumber === phone);
  return user || null;
};

export const pingGroupMembersForVote = (requestId: string): void => {
  const requests = getWithdrawalRequests();
  const request = requests.find(r => r.id === requestId);
  
  if (!request) {
    throw new Error("Withdrawal request not found");
  }
  
  if (request.status !== 'pending') {
    throw new Error(`This request is already ${request.status}`);
  }
  
  // Get contribution to find members
  const contributions = getContributions();
  const contribution = contributions.find(c => c.id === request.contributionId);
  
  if (!contribution) {
    throw new Error("Related contribution not found");
  }
  
  // Get users who haven't voted
  const votedUserIds = request.votes.map(v => v.userId);
  const membersToNotify = contribution.members.filter(id => !votedUserIds.includes(id));
  
  // Send notifications
  membersToNotify.forEach(userId => {
    addNotification({
      userId,
      message: `Reminder: Your vote is needed for a withdrawal request in "${contribution.name}"`,
      type: 'info',
      read: false,
      relatedId: requestId
    });
  });
};

export const generateContributionReceipt = (transactionId: string): any => {
  const transactions = getTransactions();
  const transaction = transactions.find(t => t.id === transactionId);
  
  if (!transaction) return null;
  
  const contributions = getContributions();
  const contribution = contributions.find(c => c.id === transaction.contributionId);
  
  const users = getUsers();
  const user = users.find(u => u.id === transaction.userId);
  
  return {
    receipt: {
      id: `rcpt_${transactionId}`,
      date: transaction.createdAt,
      amount: transaction.amount,
      contributionName: contribution?.name || "Unknown Contribution",
      contributorName: user?.name || (transaction.metaData?.contributorName || "Anonymous"),
      description: transaction.description,
      status: transaction.status,
      reference: transaction.id
    }
  };
};

export const updateWithdrawalRequestsStatus = (): void => {
  const requests = getWithdrawalRequests();
  let updated = false;
  
  requests.forEach((request, index) => {
    if (request.status === 'pending' && new Date() > new Date(request.deadline)) {
      requests[index].status = 'expired';
      updated = true;
      
      // Notify the creator
      const contributions = getContributions();
      const contribution = contributions.find(c => c.id === request.contributionId);
      
      if (contribution) {
        addNotification({
          userId: contribution.creatorId,
          message: `Withdrawal request for "${contribution.name}" has expired due to insufficient votes.`,
          type: 'warning',
          read: false,
          relatedId: request.id
        });
      }
    }
  });
  
  if (updated) {
    localStorage.setItem('withdrawalRequests', JSON.stringify(requests));
  }
};

export const markNotificationAsRead = (id: string): void => {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.notifications) return;
  
  const notifications = [...currentUser.notifications];
  const notificationIndex = notifications.findIndex(n => n.id === id);
  
  if (notificationIndex >= 0) {
    notifications[notificationIndex] = {
      ...notifications[notificationIndex],
      read: true
    };
    
    updateUser({ notifications });
  }
};

export const markAllNotificationsAsRead = (): void => {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.notifications) return;
  
  const notifications = currentUser.notifications.map(n => ({
    ...n,
    read: true
  }));
  
  updateUser({ notifications });
};
