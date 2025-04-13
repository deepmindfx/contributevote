// Add imports and re-export from the local localStorage.ts file
import { 
  ensureAccountNumberDisplay, 
  verifyUserWithOTP, 
  validateDate, 
  getContributionByAccountNumber,
  reExportEnsureAccountNumberDisplay 
} from '@/localStorage';

// Re-export them
export { 
  ensureAccountNumberDisplay, 
  verifyUserWithOTP, 
  validateDate, 
  getContributionByAccountNumber,
  reExportEnsureAccountNumberDisplay
};

import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'user' | 'admin';
  walletBalance: number;
  preferences: {
    darkMode: boolean;
    anonymousContributions: boolean;
  };
  pin?: string;
  accountNumber?: string;
  accountName?: string;
  verified: boolean;
  reservedAccount?: any;
  invoices?: any[];
  cardTokens?: any[];
  notifications?: any[];
}

export interface Contribution {
  id: string;
  name: string;
  description: string;
  targetAmount: number;
  currentAmount: number;
  startDate: string;
  endDate: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'one-time';
  category: 'personal' | 'family' | 'community';
  creatorId: string;
  members: string[];
  contributors: {
    userId?: string;
    name?: string;
    email?: string;
    phone?: string;
    amount: number;
    date: string;
    anonymous: boolean;
  }[];
  createdAt: string;
  accountNumber: string;
  contributionAmount?: number;
}

export interface WithdrawalRequest {
  id: string;
  contributionId: string;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  votes: {
    userId: string;
    vote: 'approve' | 'reject';
  }[];
  createdAt: string;
  deadline: string;
  beneficiary: string;
  accountNumber: string;
  bankName: string;
  purpose: string;
}

export interface Transaction {
  id: string;
  contributionId: string;
  userId: string;
  type: 'deposit' | 'withdrawal' | 'transfer' | 'vote';
  amount: number;
  description: string;
  createdAt: string;
  status?: 'pending' | 'completed' | 'failed';
  anonymous?: boolean;
  metaData?: any;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  createdAt: string;
  relatedId?: string;
}

export interface Stats {
  totalUsers: number;
  totalContributions: number;
  totalWithdrawals: number;
  totalAmountContributed: number;
}

// Initialize Local Storage
export const initializeLocalStorage = () => {
  if (!localStorage.getItem('users')) {
    localStorage.setItem('users', JSON.stringify([]));
  }
  if (!localStorage.getItem('contributions')) {
    localStorage.setItem('contributions', JSON.stringify([]));
  }
   if (!localStorage.getItem('withdrawalRequests')) {
    localStorage.setItem('withdrawalRequests', JSON.stringify([]));
  }
  if (!localStorage.getItem('transactions')) {
    localStorage.setItem('transactions', JSON.stringify([]));
  }
  if (!localStorage.getItem('notifications')) {
    localStorage.setItem('notifications', JSON.stringify([]));
  }
};

// Generate Dummy Data
export const generateDummyData = () => {
  const users: User[] = [
    {
      id: '1',
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '123-456-7890',
      role: 'user',
      walletBalance: 1000,
      preferences: {
        darkMode: false,
        anonymousContributions: false,
      },
      pin: '1234',
      accountNumber: '1234567890',
      accountName: 'John Doe',
      verified: true,
    },
    {
      id: '2',
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      phone: '987-654-3210',
      role: 'user',
      walletBalance: 500,
      preferences: {
        darkMode: true,
        anonymousContributions: true,
      },
      pin: '5678',
      accountNumber: '0987654321',
      accountName: 'Jane Smith',
      verified: true,
    },
    {
      id: '3',
      name: 'Admin User',
      email: 'admin@example.com',
      phone: '111-222-3333',
      role: 'admin',
      walletBalance: 10000,
      preferences: {
        darkMode: false,
        anonymousContributions: false,
      },
      pin: '0000',
      accountNumber: '1122334455',
      accountName: 'Admin User',
      verified: true,
    },
  ];

  const contributions: Contribution[] = [
    {
      id: '1',
      name: 'Community Garden',
      description: 'Help build a community garden for fresh produce.',
      targetAmount: 5000,
      currentAmount: 2500,
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      frequency: 'monthly',
      category: 'community',
      creatorId: '1',
      members: ['1', '2'],
      contributors: [
        { userId: '1', amount: 500, date: '2024-02-15', anonymous: false },
        { userId: '2', amount: 200, date: '2024-02-20', anonymous: true },
      ],
      createdAt: '2024-01-01',
      accountNumber: '6012345678',
    },
    {
      id: '2',
      name: 'Family Vacation Fund',
      description: 'Save up for a memorable family vacation.',
      targetAmount: 10000,
      currentAmount: 7500,
      startDate: '2024-03-01',
      endDate: '2024-12-31',
      frequency: 'weekly',
      category: 'family',
      creatorId: '2',
      members: ['2'],
      contributors: [
        { userId: '2', amount: 1000, date: '2024-03-05', anonymous: false },
      ],
      createdAt: '2024-03-01',
      accountNumber: '6087654321',
    },
  ];

  const withdrawalRequests: WithdrawalRequest[] = [
    {
      id: '1',
      contributionId: '1',
      amount: 1000,
      reason: 'Purchase gardening tools',
      status: 'pending',
      votes: [
        { userId: '1', vote: 'approve' },
        { userId: '2', vote: 'reject' },
      ],
      createdAt: '2024-02-28',
      deadline: '2024-03-07',
      beneficiary: 'John Doe',
      accountNumber: '1234567890',
      bankName: 'CollectiPay Bank',
      purpose: 'Purchase gardening tools',
    },
  ];

  const transactions: Transaction[] = [
    {
      id: '1',
      contributionId: '1',
      userId: '1',
      type: 'deposit',
      amount: 500,
      description: 'Contribution to Community Garden',
      createdAt: '2024-02-15',
      status: 'completed',
      anonymous: false,
    },
    {
      id: '2',
      contributionId: '2',
      userId: '2',
      type: 'deposit',
      amount: 1000,
      description: 'Contribution to Family Vacation Fund',
      createdAt: '2024-03-05',
      status: 'completed',
      anonymous: false,
    },
    {
      id: '3',
      contributionId: '1',
      userId: '1',
      type: 'withdrawal',
      amount: 1000,
      description: 'Withdrawal for gardening tools',
      createdAt: '2024-03-01',
      status: 'pending',
    },
  ];

  localStorage.setItem('users', JSON.stringify(users));
  localStorage.setItem('contributions', JSON.stringify(contributions));
  localStorage.setItem('withdrawalRequests', JSON.stringify(withdrawalRequests));
  localStorage.setItem('transactions', JSON.stringify(transactions));
};

// Local Storage API
export const createUser = (user: Omit<User, 'id' | 'role' | 'walletBalance' | 'preferences'>) => {
  const users = getUsers();
  const newUser: User = {
    id: uuidv4(),
    role: 'user',
    walletBalance: 0,
    preferences: {
      darkMode: false,
      anonymousContributions: false,
    },
    verified: false,
    ...user,
  };
  users.push(newUser);
  localStorage.setItem('users', JSON.stringify(users));
  localStorage.setItem('currentUser', JSON.stringify(newUser));
};

export const getCurrentUser = (): User => {
  const userString = localStorage.getItem('currentUser');
  return userString ? JSON.parse(userString) : null;
};

export const setCurrentUser = (user: User) => {
  localStorage.setItem('currentUser', JSON.stringify(user));
};

export const logoutUser = () => {
  localStorage.removeItem('currentUser');
};

export const getUsers = (): User[] => {
  const usersString = localStorage.getItem('users');
  return usersString ? JSON.parse(usersString) : [];
};

export const updateUser = (userData: Partial<User>) => {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  const updatedUser = { ...currentUser, ...userData };
  localStorage.setItem('currentUser', JSON.stringify(updatedUser));

  const users = getUsers();
  const userIndex = users.findIndex(user => user.id === currentUser.id);
  if (userIndex >= 0) {
    users[userIndex] = updatedUser;
    localStorage.setItem('users', JSON.stringify(users));
  }
};

export const updateUserById = (userId: string, userData: Partial<User>) => {
  const users = getUsers();
  const userIndex = users.findIndex(user => user.id === userId);
  if (userIndex >= 0) {
    users[userIndex] = { ...users[userIndex], ...userData };
    localStorage.setItem('users', JSON.stringify(users));

    // Also update currentUser if it's the same user
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      localStorage.setItem('currentUser', JSON.stringify(users[userIndex]));
    }
  }
};

export const pauseUser = (userId: string) => {
  updateUserById(userId, { role: 'paused' as any });
};

export const activateUser = (userId: string) => {
  updateUserById(userId, { role: 'user' });
};

export const depositToUser = (userId: string, amount: number) => {
  const users = getUsers();
  const userIndex = users.findIndex(user => user.id === userId);
  if (userIndex >= 0) {
    users[userIndex].walletBalance += amount;
    localStorage.setItem('users', JSON.stringify(users));

    // Also update currentUser if it's the same user
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      updateUser({ walletBalance: users[userIndex].walletBalance });
    }
  }
};

export const getContributions = (): Contribution[] => {
  const contributionsString = localStorage.getItem('contributions');
  return contributionsString ? JSON.parse(contributionsString) : [];
};

export const getUserContributions = (userId: string): Contribution[] => {
  const contributions = getContributions();
  return contributions.filter(contribution => contribution.members.includes(userId));
};

export const getContributionById = (id: string): Contribution | undefined => {
  const contributions = getContributions();
  return contributions.find(contribution => contribution.id === id);
};

export const createContribution = (contribution: Omit<Contribution, 'id' | 'createdAt' | 'currentAmount' | 'members' | 'contributors' | 'accountNumber'>) => {
  const contributions = getContributions();
  const newContribution: Contribution = {
    id: uuidv4(),
    currentAmount: 0,
    members: [getCurrentUser().id],
    contributors: [],
    createdAt: new Date().toISOString(),
    accountNumber: `60${Math.floor(10000000 + Math.random() * 90000000)}`,
    ...contribution,
  };
  contributions.push(newContribution);
  localStorage.setItem('contributions', JSON.stringify(contributions));
  return newContribution;
};

export const updateContribution = (id: string, contributionData: Partial<Contribution>) => {
  const contributions = getContributions();
  const contributionIndex = contributions.findIndex(contribution => contribution.id === id);
  if (contributionIndex >= 0) {
    contributions[contributionIndex] = { ...contributions[contributionIndex], ...contributionData };
    localStorage.setItem('contributions', JSON.stringify(contributions));
  }
};

export const contributeToGroup = (contributionId: string, amount: number, anonymous: boolean = false) => {
  const user = getCurrentUser();
  if (!user) throw new Error('User not logged in');

  const contribution = getContributionById(contributionId);
  if (!contribution) throw new Error('Contribution group not found');

  if (user.walletBalance < amount) throw new Error('Insufficient funds in your wallet');

  // Update user's wallet balance
  updateUserBalance(user.id, user.walletBalance - amount);

  // Add contribution to the group
  contribution.currentAmount += amount;

  // Add contributor to the contribution group
  const date = new Date().toISOString();
  contribution.contributors.push({
    userId: user.id,
    amount,
    date,
    anonymous,
  });

  // Update contribution in local storage
  updateContribution(contributionId, {
    currentAmount: contribution.currentAmount,
    contributors: contribution.contributors,
  });

  // Create a transaction record
  createTransaction({
    contributionId,
    userId: user.id,
    type: 'deposit',
    amount,
    description: `Contribution to ${contribution.name}`,
    anonymous,
  });
};

export const contributeByAccountNumber = (accountNumber: string, amount: number, contributorInfo: { name: string, email?: string, phone?: string }, anonymous: boolean = false) => {
  const user = getCurrentUser();
  const contribution = getContributionByAccountNumber(accountNumber);
  
  if (!contribution) {
    throw new Error('Contribution group not found with this account number');
  }
  
  // For simplicity, we'll assume the user is logged in and has sufficient balance
  if (!user) {
    throw new Error('User not logged in');
  }
  
  if (user.walletBalance < amount) {
    throw new Error('Insufficient funds in your wallet');
  }
  
  // Update user's wallet balance
  updateUserBalance(user.id, user.walletBalance - amount);
  
  // Add contribution to the group
  contribution.currentAmount += amount;
  
  // Add contributor to the contribution group
  const date = new Date().toISOString();
  contribution.contributors.push({
    name: contributorInfo.name,
    email: contributorInfo.email,
    phone: contributorInfo.phone,
    amount,
    date,
    anonymous,
  });
  
  // Update contribution in local storage
  updateContribution(contribution.id, {
    currentAmount: contribution.currentAmount,
    contributors: contribution.contributors,
  });
  
  // Create a transaction record
  createTransaction({
    contributionId: contribution.id,
    userId: user.id,
    type: 'deposit',
    amount,
    description: `Contribution to ${contribution.name}`,
    anonymous,
  });
};

export const updateUserBalance = (userId: string, newBalance: number) => {
  const users = getUsers();
  const userIndex = users.findIndex(user => user.id === userId);
  if (userIndex >= 0) {
    users[userIndex].walletBalance = newBalance;
    localStorage.setItem('users', JSON.stringify(users));

    // Update current user if it's the same user
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      updateUser({ walletBalance: newBalance });
    }
  }
};

export const getWithdrawalRequests = (): WithdrawalRequest[] => {
  const withdrawalRequestsString = localStorage.getItem('withdrawalRequests');
  return withdrawalRequestsString ? JSON.parse(withdrawalRequestsString) : [];
};

export const createWithdrawalRequest = (request: Omit<WithdrawalRequest, 'id' | 'createdAt' | 'status' | 'votes' | 'deadline'>) => {
  const user = getCurrentUser();
  if (!user) throw new Error('User not logged in');

  const contribution = getContributionById(request.contributionId);
   if (!contribution) throw new Error('Contribution group not found');
  
  if (contribution.creatorId !== user.id) throw new Error('Only the group creator can request withdrawals');

  const withdrawalRequests = getWithdrawalRequests();
  const newWithdrawalRequest: WithdrawalRequest = {
    id: uuidv4(),
    status: 'pending',
    votes: [],
    createdAt: new Date().toISOString(),
    deadline: format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd HH:mm'), // 24 hours from now
    ...request,
  };
  withdrawalRequests.push(newWithdrawalRequest);
  localStorage.setItem('withdrawalRequests', JSON.stringify(withdrawalRequests));
  
  // Create a transaction record
  createTransaction({
    contributionId: request.contributionId,
    userId: user.id,
    type: 'withdrawal',
    amount: request.amount,
    description: `Withdrawal request for ${request.purpose}`,
    status: 'pending',
  });
};

export const updateWithdrawalRequest = (id: string, requestData: Partial<WithdrawalRequest>) => {
  const withdrawalRequests = getWithdrawalRequests();
  const requestIndex = withdrawalRequests.findIndex(request => request.id === id);
  if (requestIndex >= 0) {
    withdrawalRequests[requestIndex] = { ...withdrawalRequests[requestIndex], ...requestData };
    localStorage.setItem('withdrawalRequests', JSON.stringify(withdrawalRequests));
  }
};

export const voteOnWithdrawalRequest = (requestId: string, voteValue: 'approve' | 'reject') => {
  const user = getCurrentUser();
  if (!user) throw new Error('User not logged in');

  const withdrawalRequests = getWithdrawalRequests();
  const requestIndex = withdrawalRequests.findIndex(request => request.id === requestId);

  if (requestIndex < 0) {
    throw new Error('Withdrawal request not found');
  }

  const request = withdrawalRequests[requestIndex];
  const contribution = getContributionById(request.contributionId);

  if (!contribution) {
    throw new Error('Contribution group not found');
  }

  // Check if the user is a member of the contribution group
  if (!contribution.members.includes(user.id)) {
    throw new Error('You are not a member of this contribution group');
  }

  // Check if the user has contributed to the group
  if (!hasContributed(user.id, contribution.id)) {
    throw new Error('You must contribute to this group before voting');
  }

  // Check if the user has already voted
  const existingVote = request.votes.find(vote => vote.userId === user.id);
  if (existingVote) {
    throw new Error('You have already voted on this request');
  }

  // Add the vote
  request.votes.push({ userId: user.id, vote: voteValue });
  withdrawalRequests[requestIndex] = request;
  localStorage.setItem('withdrawalRequests', JSON.stringify(withdrawalRequests));
};

export const hasContributed = (userId: string, contributionId: string): boolean => {
  const contribution = getContributionById(contributionId);
  if (!contribution) return false;
  return contribution.contributors.some(contributor => contributor.userId === userId);
};

// Transaction functions
export const getTransactions = (): Transaction[] => {
  const transactionsString = localStorage.getItem('transactions');
  return transactionsString ? JSON.parse(transactionsString) : [];
};

export const createTransaction = (transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
  const transactions = getTransactions();
  const newTransaction: Transaction = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    ...transaction,
  };
  transactions.push(newTransaction);
  localStorage.setItem('transactions', JSON.stringify(transactions));
};

export const addTransaction = createTransaction;

export const getNotifications = (userId: string): Notification[] => {
  const notificationsString = localStorage.getItem('notifications');
  const notifications: Notification[] = notificationsString ? JSON.parse(notificationsString) : [];
  return notifications.filter(notification => notification.userId === userId);
};

export const addNotification = (notification: Omit<Notification, 'id' | 'createdAt'>) => {
  const notifications = getNotifications(notification.userId);
  const newNotification: Notification = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    ...notification,
  };
  notifications.push(newNotification);
  localStorage.setItem('notifications', JSON.stringify(notifications));
};

export const markNotificationAsRead = (id: string) => {
  const notificationsString = localStorage.getItem('notifications');
  if (!notificationsString) return;

  const notifications: Notification[] = JSON.parse(notificationsString);
  const notificationIndex = notifications.findIndex(notification => notification.id === id);
  if (notificationIndex >= 0) {
    notifications[notificationIndex].read = true;
    localStorage.setItem('notifications', JSON.stringify(notifications));
  }
};

export const getStatistics = (): Stats => {
  const users = getUsers();
  const contributions = getContributions();
  const withdrawalRequests = getWithdrawalRequests();
  const transactions = getTransactions();

  const totalAmountContributed = transactions
    .filter(transaction => transaction.type === 'deposit')
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  return {
    totalUsers: users.length,
    totalContributions: contributions.length,
    totalWithdrawals: withdrawalRequests.length,
    totalAmountContributed,
  };
};

export const generateShareLink = (contributionId: string): string => {
  return `${window.location.origin}/contribute/share/${contributionId}`;
};

export const getUserByEmail = (email: string): User | null => {
  const users = getUsers();
  return users.find(user => user.email === email) || null;
};

export const getUserByPhone = (phone: string): User | null => {
  const users = getUsers();
  return users.find(user => user.phone === phone) || null;
};

export const pingGroupMembersForVote = (requestId: string) => {
  const withdrawalRequests = getWithdrawalRequests();
  const requestIndex = withdrawalRequests.findIndex(request => request.id === requestId);
  
  if (requestIndex < 0) {
    throw new Error('Withdrawal request not found');
  }
  
  const request = withdrawalRequests[requestIndex];
  const contribution = getContributionById(request.contributionId);
  
  if (!contribution) {
    throw new Error('Contribution group not found');
  }
  
  // Get IDs of members who have not voted
  const nonVoters = contribution.members.filter(memberId => {
    return !request.votes.some(vote => vote.userId === memberId) && hasContributed(memberId, contribution.id);
  });
  
  if (nonVoters.length === 0) {
    throw new Error('All members have already voted');
  }
  
  // In a real app, we would send notifications to these members
  nonVoters.forEach(memberId => {
    const member = getUsers().find(user => user.id === memberId);
    if (member) {
      addNotification({
        userId: memberId,
        message: `Reminder: Vote on the withdrawal request for "${contribution.name}"`,
        type: 'info',
        read: false,
        relatedId: requestId,
      });
      console.log(`Sending reminder to ${member.name} to vote on request ${requestId}`);
    }
  });
};

export const generateContributionReceipt = (transactionId: string) => {
  const transaction = getTransactions().find(t => t.id === transactionId);
  if (!transaction) return null;
  
  const contribution = getContributionById(transaction.contributionId);
  if (!contribution) return null;
  
  const user = getUsers().find(u => u.id === transaction.userId);
  if (!user) return null;
  
  return {
    receiptNumber: `RCPT-${Math.floor(1000 + Math.random() * 9000)}`,
    date: transaction.createdAt,
    contributionName: contribution.name,
    accountNumber: contribution.accountNumber,
    contributorName: user.name,
    amount: transaction.amount,
  };
};

export const updateWithdrawalRequestsStatus = () => {
  const withdrawalRequests = getWithdrawalRequests();
  let updated = false;
  
  withdrawalRequests.forEach(request => {
    if (request.status === 'pending' && request.deadline) {
      const deadlineDate = new Date(request.deadline);
      const now = new Date();
      
      if (deadlineDate < now) {
        request.status = 'expired';
        updated = true;
      } else {
        // Count the number of approvals and rejections
        const approvals = request.votes.filter(vote => vote.vote === 'approve').length;
        const rejections = request.votes.filter(vote => vote.vote === 'reject').length;
        
        // Calculate the number of members who have contributed
        const totalContributors = getContributionById(request.contributionId)?.members.filter(memberId => hasContributed(memberId, request.contributionId)).length || 0;
        
        // Determine if 51% of contributors have approved the request
        const approvalThreshold = totalContributors * 0.51;
        
        if (approvals >= approvalThreshold) {
          request.status = 'approved';
          updated = true;
        } else if (rejections > (totalContributors - approvalThreshold)) {
          request.status = 'rejected';
          updated = true;
        }
      }
    }
  });
  
  if (updated) {
    localStorage.setItem('withdrawalRequests', JSON.stringify(withdrawalRequests));
  }
};

// Export the function to mark all notifications as read for a user
export const markAllNotificationsAsRead = (userId: string) => {
  const notificationsString = localStorage.getItem('notifications');
  if (!notificationsString) return;

  const notifications: Notification[] = JSON.parse(notificationsString);
  let updated = false;
  
  notifications.forEach(notification => {
    if (notification.userId === userId && !notification.read) {
      notification.read = true;
      updated = true;
    }
  });
  
  if (updated) {
    localStorage.setItem('notifications', JSON.stringify(notifications));
  }
};
