
import { v4 as uuidv4 } from 'uuid';

export interface User {
  id: string;
  name: string;
  email: string;
  walletBalance: number;
  profileImage?: string;
  phoneNumber?: string;
  preferences?: {
    anonymousContributions: boolean;
    darkMode: boolean;
    notificationsEnabled: boolean;
  };
  notifications?: Notification[];
  role?: 'user' | 'admin';
  status?: 'active' | 'paused';
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
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
  creatorId: string;
  createdAt: string;
  category: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'one-time';
  contributionAmount: number;
  startDate: string;
  endDate?: string;
  votingThreshold: number;
  privacy: 'public' | 'private';
  memberRoles: 'equal' | 'weighted';
  members: string[];
  contributors: {
    userId: string;
    name: string;
    amount: number;
    anonymous: boolean;
    date: string;
  }[];
}

export interface WithdrawalRequest {
  id: string;
  contributionId: string;
  requesterId: string;
  amount: number;
  purpose: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  votes: { 
    userId: string; 
    vote: 'approve' | 'reject';
  }[];
}

export interface Transaction {
  id: string;
  userId: string;
  contributionId: string;
  type: 'deposit' | 'withdrawal' | 'vote';
  amount: number;
  status: 'pending' | 'completed' | 'rejected';
  description: string;
  createdAt: string;
  relatedId?: string;  // for withdrawal requests or votes
  anonymous?: boolean;
}

export interface Stats {
  totalUsers: number;
  totalContributions: number;
  totalTransactions: number;
  totalAmount: number;
  activeRequests: number;
}

// Initialize default user
const initializeUser = (): User => {
  const defaultUser = {
    id: uuidv4(),
    name: 'John Doe',
    email: 'john@example.com',
    walletBalance: 0,
    profileImage: '',
    phoneNumber: '',
    preferences: {
      anonymousContributions: false,
      darkMode: false,
      notificationsEnabled: true,
    },
    notifications: [],
    role: 'user',
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  
  localStorage.setItem('currentUser', JSON.stringify(defaultUser));
  return defaultUser;
};

// Initialize admin user
const initializeAdmin = (): User => {
  const admin = {
    id: uuidv4(),
    name: 'Admin',
    email: 'admin@collectipay.com',
    walletBalance: 0,
    profileImage: '',
    phoneNumber: '',
    preferences: {
      anonymousContributions: false,
      darkMode: false,
      notificationsEnabled: true,
    },
    notifications: [],
    role: 'admin',
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  
  const users = getUsers();
  const existingAdmin = users.find(u => u.role === 'admin');
  
  if (!existingAdmin) {
    users.push(admin);
    localStorage.setItem('users', JSON.stringify(users));
  }
  
  return admin;
};

// User methods
export const getCurrentUser = (): User => {
  const userString = localStorage.getItem('currentUser');
  if (!userString) {
    return initializeUser();
  }
  return JSON.parse(userString);
};

export const updateUser = (userData: Partial<User>): User => {
  const user = getCurrentUser();
  const updatedUser = { ...user, ...userData };
  localStorage.setItem('currentUser', JSON.stringify(updatedUser));
  
  // Also update in users list
  const users = getUsers();
  const index = users.findIndex(u => u.id === user.id);
  if (index >= 0) {
    users[index] = { ...users[index], ...userData };
    localStorage.setItem('users', JSON.stringify(users));
  }
  
  return updatedUser;
};

export const updateUserBalance = (amount: number): User => {
  const user = getCurrentUser();
  user.walletBalance += amount;
  localStorage.setItem('currentUser', JSON.stringify(user));
  
  // Also update in users list
  const users = getUsers();
  const index = users.findIndex(u => u.id === user.id);
  if (index >= 0) {
    users[index].walletBalance = user.walletBalance;
    localStorage.setItem('users', JSON.stringify(users));
  }
  
  return user;
};

// Users management
export const getUsers = (): User[] => {
  const usersString = localStorage.getItem('users');
  if (!usersString) {
    return [];
  }
  return JSON.parse(usersString);
};

export const getUserById = (userId: string): User | null => {
  const users = getUsers();
  return users.find(u => u.id === userId) || null;
};

export const getUserByEmail = (email: string): User | null => {
  const users = getUsers();
  return users.find(u => u.email === email) || null;
};

export const getUserByPhone = (phone: string): User | null => {
  const users = getUsers();
  return users.find(u => u.phoneNumber === phone) || null;
};

export const updateUserById = (userId: string, userData: Partial<User>): User | null => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === userId);
  
  if (index >= 0) {
    users[index] = { ...users[index], ...userData };
    localStorage.setItem('users', JSON.stringify(users));
    
    // If this is the current user, update that too
    const currentUser = getCurrentUser();
    if (currentUser.id === userId) {
      localStorage.setItem('currentUser', JSON.stringify(users[index]));
    }
    
    return users[index];
  }
  
  return null;
};

export const depositToUser = (userId: string, amount: number): User | null => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === userId);
  
  if (index >= 0) {
    users[index].walletBalance += amount;
    localStorage.setItem('users', JSON.stringify(users));
    
    // If this is the current user, update that too
    const currentUser = getCurrentUser();
    if (currentUser.id === userId) {
      currentUser.walletBalance = users[index].walletBalance;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    }
    
    // Add transaction
    addTransaction({
      userId,
      contributionId: '',
      type: 'deposit',
      amount,
      status: 'completed',
      description: 'Admin deposit to wallet',
      createdAt: new Date().toISOString(),
    });
    
    // Add notification
    addNotification({
      userId,
      message: `Admin deposited ₦${amount.toLocaleString()} to your wallet`,
      type: 'success',
      read: false,
      relatedId: '',
    });
    
    return users[index];
  }
  
  return null;
};

export const pauseUser = (userId: string): User | null => {
  return updateUserById(userId, { status: 'paused' });
};

export const activateUser = (userId: string): User | null => {
  return updateUserById(userId, { status: 'active' });
};

// Notification methods
export const addNotification = (notification: Omit<Notification, 'id' | 'createdAt'>): Notification => {
  const user = getCurrentUser();
  const notifications = user.notifications || [];
  
  const newNotification: Notification = {
    ...notification,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
  };
  
  notifications.push(newNotification);
  user.notifications = notifications;
  localStorage.setItem('currentUser', JSON.stringify(user));
  
  return newNotification;
};

export const markNotificationAsRead = (id: string): void => {
  const user = getCurrentUser();
  if (!user.notifications) return;
  
  const index = user.notifications.findIndex(n => n.id === id);
  if (index >= 0) {
    user.notifications[index].read = true;
    localStorage.setItem('currentUser', JSON.stringify(user));
  }
};

export const markAllNotificationsAsRead = (): void => {
  const user = getCurrentUser();
  if (!user.notifications) return;
  
  user.notifications = user.notifications.map(n => ({ ...n, read: true }));
  localStorage.setItem('currentUser', JSON.stringify(user));
};

// Contribution methods
export const getContributions = (): Contribution[] => {
  const contributionsString = localStorage.getItem('contributions');
  if (!contributionsString) {
    return [];
  }
  const contributions = JSON.parse(contributionsString);
  
  // Sort contributions by creation date (newest first)
  return contributions.sort((a: Contribution, b: Contribution) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

export const getContribution = (id: string): Contribution | null => {
  const contributions = getContributions();
  return contributions.find(c => c.id === id) || null;
};

export const createContribution = (contribution: Omit<Contribution, 'id' | 'createdAt' | 'currentAmount' | 'members' | 'contributors'>): Contribution => {
  const contributions = getContributions();
  const currentUser = getCurrentUser();
  
  const newContribution: Contribution = {
    ...contribution,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    currentAmount: 0,
    members: [currentUser.id],
    contributors: []
  };
  
  contributions.push(newContribution);
  localStorage.setItem('contributions', JSON.stringify(contributions));
  
  // Create initial transaction
  addTransaction({
    userId: currentUser.id,
    contributionId: newContribution.id,
    type: 'deposit',
    amount: 0,
    status: 'completed',
    description: `Created ${newContribution.name} contribution group`,
    createdAt: new Date().toISOString(),
  });
  
  // Add notification
  addNotification({
    userId: currentUser.id,
    message: `You created a new contribution group: ${newContribution.name}`,
    type: 'success',
    read: false,
    relatedId: newContribution.id,
  });
  
  return newContribution;
};

export const contributeToGroup = (contributionId: string, amount: number, anonymous: boolean = false): Contribution => {
  const contributions = getContributions();
  const currentUser = getCurrentUser();
  
  // Deduct from user's wallet
  updateUserBalance(-amount);
  
  // Update contribution
  const index = contributions.findIndex(c => c.id === contributionId);
  if (index >= 0) {
    contributions[index].currentAmount += amount;
    
    // Add contributor info
    contributions[index].contributors.push({
      userId: currentUser.id,
      name: currentUser.name,
      amount,
      anonymous,
      date: new Date().toISOString()
    });
    
    localStorage.setItem('contributions', JSON.stringify(contributions));
    
    // Add transaction
    addTransaction({
      userId: currentUser.id,
      contributionId,
      type: 'deposit',
      amount,
      status: 'completed',
      description: `Contributed to ${contributions[index].name}`,
      createdAt: new Date().toISOString(),
      anonymous,
    });
    
    // Add notification to creator
    if (contributions[index].creatorId !== currentUser.id) {
      addNotification({
        userId: contributions[index].creatorId,
        message: `${anonymous ? 'Someone' : currentUser.name} contributed ₦${amount.toLocaleString()} to ${contributions[index].name}`,
        type: 'info',
        read: false,
        relatedId: contributionId,
      });
    }
    
    return contributions[index];
  }
  
  throw new Error('Contribution not found');
};

// Withdrawal request methods
export const getWithdrawalRequests = (): WithdrawalRequest[] => {
  const requestsString = localStorage.getItem('withdrawalRequests');
  if (!requestsString) {
    return [];
  }
  return JSON.parse(requestsString);
};

export const getWithdrawalRequestsForContribution = (contributionId: string): WithdrawalRequest[] => {
  const requests = getWithdrawalRequests();
  return requests.filter(r => r.contributionId === contributionId);
};

export const createWithdrawalRequest = (request: Omit<WithdrawalRequest, 'id' | 'createdAt' | 'status' | 'votes'>): WithdrawalRequest => {
  const requests = getWithdrawalRequests();
  const currentUser = getCurrentUser();
  const contribution = getContribution(request.contributionId);
  
  const newRequest: WithdrawalRequest = {
    ...request,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    status: 'pending',
    votes: [],
  };
  
  requests.push(newRequest);
  localStorage.setItem('withdrawalRequests', JSON.stringify(requests));
  
  // Create transaction for withdrawal request
  addTransaction({
    userId: currentUser.id,
    contributionId: request.contributionId,
    type: 'vote',
    amount: request.amount,
    status: 'pending',
    description: `Withdrawal request: ${request.purpose}`,
    createdAt: new Date().toISOString(),
    relatedId: newRequest.id,
  });
  
  // Add notifications to all members
  if (contribution) {
    contribution.members.forEach(memberId => {
      if (memberId !== currentUser.id) {
        addNotification({
          userId: memberId,
          message: `New withdrawal request of ₦${request.amount.toLocaleString()} from ${contribution.name}`,
          type: 'warning',
          read: false,
          relatedId: newRequest.id,
        });
      }
    });
  }
  
  return newRequest;
};

export const voteOnWithdrawalRequest = (requestId: string, vote: 'approve' | 'reject'): WithdrawalRequest => {
  const requests = getWithdrawalRequests();
  const currentUser = getCurrentUser();
  
  const index = requests.findIndex(r => r.id === requestId);
  if (index >= 0) {
    // Remove existing vote if any
    requests[index].votes = requests[index].votes.filter(v => v.userId !== currentUser.id);
    
    // Add new vote
    requests[index].votes.push({
      userId: currentUser.id,
      vote,
    });
    
    // Check if threshold is reached
    const contribution = getContribution(requests[index].contributionId);
    if (contribution) {
      const approvalVotes = requests[index].votes.filter(v => v.vote === 'approve').length;
      const totalMembers = contribution.members.length;
      const approvalPercentage = (approvalVotes / totalMembers) * 100;
      
      if (approvalPercentage >= contribution.votingThreshold) {
        // Approve and process withdrawal
        requests[index].status = 'approved';
        
        // Update contribution amount
        const contributions = getContributions();
        const contribIndex = contributions.findIndex(c => c.id === contribution.id);
        contributions[contribIndex].currentAmount -= requests[index].amount;
        localStorage.setItem('contributions', JSON.stringify(contributions));
        
        // Add transaction
        addTransaction({
          userId: requests[index].requesterId,
          contributionId: contribution.id,
          type: 'withdrawal',
          amount: requests[index].amount,
          status: 'completed',
          description: `Withdrawal for: ${requests[index].purpose}`,
          createdAt: new Date().toISOString(),
          relatedId: requestId,
        });
        
        // Add notification
        addNotification({
          userId: requests[index].requesterId,
          message: `Your withdrawal request of ₦${requests[index].amount.toLocaleString()} was approved!`,
          type: 'success',
          read: false,
          relatedId: requestId,
        });
      } else if (requests[index].votes.length === totalMembers && approvalPercentage < contribution.votingThreshold) {
        // Everyone has voted but threshold not met
        requests[index].status = 'rejected';
        
        // Add notification
        addNotification({
          userId: requests[index].requesterId,
          message: `Your withdrawal request of ₦${requests[index].amount.toLocaleString()} was rejected`,
          type: 'error',
          read: false,
          relatedId: requestId,
        });
      }
    }
    
    localStorage.setItem('withdrawalRequests', JSON.stringify(requests));
    
    // Add vote transaction
    addTransaction({
      userId: currentUser.id,
      contributionId: requests[index].contributionId,
      type: 'vote',
      amount: 0,
      status: 'completed',
      description: `Voted ${vote} on withdrawal request`,
      createdAt: new Date().toISOString(),
      relatedId: requestId,
    });
    
    return requests[index];
  }
  
  throw new Error('Withdrawal request not found');
};

// Transaction methods
export const getTransactions = (): Transaction[] => {
  const transactionsString = localStorage.getItem('transactions');
  if (!transactionsString) {
    return [];
  }
  return JSON.parse(transactionsString);
};

export const getTransactionsForUser = (userId: string): Transaction[] => {
  const transactions = getTransactions();
  return transactions.filter(t => t.userId === userId);
};

export const getTransactionsForContribution = (contributionId: string): Transaction[] => {
  const transactions = getTransactions();
  return transactions.filter(t => t.contributionId === contributionId);
};

export const addTransaction = (transaction: Omit<Transaction, 'id'>): Transaction => {
  const transactions = getTransactions();
  
  const newTransaction: Transaction = {
    ...transaction,
    id: uuidv4(),
  };
  
  transactions.push(newTransaction);
  localStorage.setItem('transactions', JSON.stringify(transactions));
  
  return newTransaction;
};

// Share methods
export const generateShareLink = (contributionId: string): string => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/contribute/${contributionId}`;
};

// Statistics methods
export const getStatistics = (): Stats => {
  const users = getUsers();
  const contributions = getContributions();
  const transactions = getTransactions();
  const withdrawalRequests = getWithdrawalRequests();
  
  return {
    totalUsers: users.length,
    totalContributions: contributions.length,
    totalTransactions: transactions.length,
    totalAmount: transactions
      .filter(t => t.type === 'deposit' && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0),
    activeRequests: withdrawalRequests.filter(r => r.status === 'pending').length
  };
};

// Initialize with empty data
export const initializeLocalStorage = () => {
  if (!localStorage.getItem('currentUser')) {
    initializeUser();
  }
  
  if (!localStorage.getItem('users')) {
    const currentUser = getCurrentUser();
    localStorage.setItem('users', JSON.stringify([currentUser]));
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
  
  // Initialize admin account
  initializeAdmin();
  
  // Clear any test data
  const users = getUsers().filter(u => u.role !== 'admin' && u.id === getCurrentUser().id);
  users.forEach(u => {
    u.walletBalance = 0; // Reset balance
  });
  localStorage.setItem('users', JSON.stringify([...users, initializeAdmin()]));
  
  // Reset current user wallet balance
  const currentUser = getCurrentUser();
  currentUser.walletBalance = 0;
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
  
  // Clear all contributions, withdrawal requests, and transactions
  localStorage.setItem('contributions', JSON.stringify([]));
  localStorage.setItem('withdrawalRequests', JSON.stringify([]));
  localStorage.setItem('transactions', JSON.stringify([]));
};
