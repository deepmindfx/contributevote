import { v4 as uuidv4 } from 'uuid';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  walletBalance: number;
  profileImage?: string;
  phoneNumber?: string;
  username?: string;
  pin?: string;
  preferences?: {
    anonymousContributions: boolean;
    darkMode: boolean;
    notificationsEnabled: boolean;
  };
  notifications?: Notification[];
  role?: 'user' | 'admin';
  status?: 'active' | 'paused';
  createdAt: string;
  verified?: boolean;
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
  votingThreshold: number; // This will always be set to 51 now
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
  accountNumber: string; // New field for group account number
}

export interface WithdrawalRequest {
  id: string;
  contributionId: string;
  requesterId: string;
  amount: number;
  purpose: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  deadline: string; // New field for 24-hour deadline
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
    firstName: 'John',
    lastName: 'Doe',
    name: 'John Doe',
    email: 'john@example.com',
    walletBalance: 0,
    profileImage: '',
    phoneNumber: '',
    username: '',
    pin: '',
    preferences: {
      anonymousContributions: false,
      darkMode: false,
      notificationsEnabled: true,
    },
    notifications: [],
    role: 'user' as const,
    status: 'active' as const,
    createdAt: new Date().toISOString(),
  };
  
  localStorage.setItem('currentUser', JSON.stringify(defaultUser));
  return defaultUser;
};

// Initialize admin user
const initializeAdmin = (): User => {
  const admin = {
    id: uuidv4(),
    firstName: 'Admin',
    lastName: 'User',
    name: 'Admin User',
    email: 'admin@collectipay.com',
    walletBalance: 0,
    profileImage: '',
    phoneNumber: 'admin',
    username: 'admin',
    pin: '1234',
    preferences: {
      anonymousContributions: false,
      darkMode: false,
      notificationsEnabled: true,
    },
    notifications: [],
    role: 'admin' as const,
    status: 'active' as const,
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
    return {} as User; // Return empty user instead of auto-initializing
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

// Admin specific functions
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

// Generate a unique 10-digit account number
export const generateAccountNumber = (): string => {
  // Generate a random 10-digit number but ensure it doesn't start with 0
  const firstDigit = Math.floor(Math.random() * 9) + 1; // 1-9
  const remainingDigits = Math.floor(Math.random() * 1000000000); // 0-999999999
  const paddedRemaining = remainingDigits.toString().padStart(9, '0');
  
  return `${firstDigit}${paddedRemaining}`;
};

// Verify if an account number already exists
export const accountNumberExists = (accountNumber: string): boolean => {
  const contributions = getContributions();
  return contributions.some(c => c.accountNumber === accountNumber);
};

// Get a unique account number
export const getUniqueAccountNumber = (): string => {
  let accountNumber = generateAccountNumber();
  while (accountNumberExists(accountNumber)) {
    accountNumber = generateAccountNumber();
  }
  return accountNumber;
};

// Get contribution by account number
export const getContributionByAccountNumber = (accountNumber: string): Contribution | null => {
  const contributions = getContributions();
  return contributions.find(c => c.accountNumber === accountNumber) || null;
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

export const getUserContributions = (userId: string): Contribution[] => {
  const allContributions = getContributions();
  return allContributions.filter(c => 
    c.creatorId === userId || c.members.includes(userId)
  );
};

export const getContribution = (id: string): Contribution | null => {
  const contributions = getContributions();
  return contributions.find(c => c.id === id) || null;
};

export const createContribution = (contribution: Omit<Contribution, 'id' | 'createdAt' | 'currentAmount' | 'members' | 'contributors' | 'accountNumber'>): Contribution => {
  const contributions = getContributions();
  const currentUser = getCurrentUser();
  
  // Generate a unique account number for the group
  const accountNumber = getUniqueAccountNumber();
  
  const newContribution: Contribution = {
    ...contribution,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    currentAmount: 0,
    members: [currentUser.id],
    contributors: [],
    accountNumber: accountNumber,
    votingThreshold: 51 // Fixed at 51% as per requirements
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
    
    // Add user to members if not already there
    if (!contributions[index].members.includes(currentUser.id)) {
      contributions[index].members.push(currentUser.id);
    }
    
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

// Contribution by account number
export const contributeByAccountNumber = (accountNumber: string, amount: number, contributorInfo: { name: string, email?: string, phone?: string }, anonymous: boolean = false): Contribution | null => {
  const contribution = getContributionByAccountNumber(accountNumber);
  
  if (!contribution) {
    throw new Error('Invalid account number');
  }
  
  // Check if contributor is a registered user
  let contributorUser = null;
  if (contributorInfo.email) {
    contributorUser = getUserByEmail(contributorInfo.email);
  } else if (contributorInfo.phone) {
    contributorUser = getUserByPhone(contributorInfo.phone);
  }
  
  if (contributorUser) {
    // If user exists, use their wallet balance
    if (contributorUser.walletBalance < amount) {
      throw new Error('Insufficient funds in wallet');
    }
    
    updateUserById(contributorUser.id, { walletBalance: contributorUser.walletBalance - amount });
    
    // Update contribution
    const contributions = getContributions();
    const index = contributions.findIndex(c => c.id === contribution.id);
    
    if (index >= 0) {
      contributions[index].currentAmount += amount;
      
      // Add contributor info
      contributions[index].contributors.push({
        userId: contributorUser.id,
        name: contributorUser.name,
        amount,
        anonymous,
        date: new Date().toISOString()
      });
      
      // Add user to members if not already there
      if (!contributions[index].members.includes(contributorUser.id)) {
        contributions[index].members.push(contributorUser.id);
      }
      
      localStorage.setItem('contributions', JSON.stringify(contributions));
      
      // Add transaction
      addTransaction({
        userId: contributorUser.id,
        contributionId: contribution.id,
        type: 'deposit',
        amount,
        status: 'completed',
        description: `Contributed to ${contribution.name}`,
        createdAt: new Date().toISOString(),
        anonymous,
      });
      
      // Add notification to creator
      if (contribution.creatorId !== contributorUser.id) {
        addNotification({
          userId: contribution.creatorId,
          message: `${anonymous ? 'Someone' : contributorUser.name} contributed ₦${amount.toLocaleString()} to ${contribution.name}`,
          type: 'info',
          read: false,
          relatedId: contribution.id,
        });
      }
      
      return contributions[index];
    }
  } else {
    // Anonymous contributor (not registered)
    // Still update the contribution but they won't have voting rights
    const contributions = getContributions();
    const index = contributions.findIndex(c => c.id === contribution.id);
    
    if (index >= 0) {
      contributions[index].currentAmount += amount;
      
      // Add contributor info with generated ID for non-users
      const nonUserContributorId = `anon-${uuidv4()}`;
      
      contributions[index].contributors.push({
        userId: nonUserContributorId,
        name: contributorInfo.name || 'Anonymous Contributor',
        amount,
        anonymous: true,
        date: new Date().toISOString()
      });
      
      localStorage.setItem('contributions', JSON.stringify(contributions));
      
      // Add transaction with the anonymous ID
      addTransaction({
        userId: nonUserContributorId,
        contributionId: contribution.id,
        type: 'deposit',
        amount,
        status: 'completed',
        description: `External contribution to ${contribution.name}`,
        createdAt: new Date().toISOString(),
        anonymous: true,
      });
      
      // Add notification to creator
      addNotification({
        userId: contribution.creatorId,
        message: `An anonymous external contributor added ₦${amount.toLocaleString()} to ${contribution.name}`,
        type: 'info',
        read: false,
        relatedId: contribution.id,
      });
      
      return contributions[index];
    }
  }
  
  return null;
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

export const createWithdrawalRequest = (request: Omit<WithdrawalRequest, 'id' | 'createdAt' | 'status' | 'votes' | 'deadline'>): WithdrawalRequest => {
  const requests = getWithdrawalRequests();
  const currentUser = getCurrentUser();
  const contribution = getContribution(request.contributionId);
  
  // Check if user is the creator of the contribution
  if (contribution && contribution.creatorId !== currentUser.id) {
    throw new Error('Only the group creator can request withdrawals');
  }
  
  // Set deadline to 24 hours from now
  const deadline = new Date();
  deadline.setHours(deadline.getHours() + 24);
  
  const newRequest: WithdrawalRequest = {
    ...request,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    status: 'pending',
    votes: [],
    deadline: deadline.toISOString()
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

// Add function to check if a user has contributed to a group
export const hasContributed = (userId: string, contributionId: string): boolean => {
  const contributions = getContributions();
  const contribution = contributions.find(c => c.id === contributionId);
  
  if (!contribution) return false;
  
  return contribution.contributors.some(c => c.userId === userId);
};

// Add function to check if a user is eligible to vote
export const canVote = (userId: string, contributionId: string): boolean => {
  // User must have contributed to the group to be eligible to vote
  return hasContributed(userId, contributionId);
};

// Function to check if a withdrawal request is expired
export const isWithdrawalRequestExpired = (request: WithdrawalRequest): boolean => {
  const deadlineDate = new Date(request.deadline);
  const now = new Date();
  return now > deadlineDate;
};

// Function to ping/remind group members to vote
export const pingGroupMembersForVote = (requestId: string): void => {
  const requests = getWithdrawalRequests();
  const request = requests.find(r => r.id === requestId);
  
  if (!request) {
    throw new Error('Withdrawal request not found');
  }
  
  const contribution = getContribution(request.contributionId);
  if (!contribution) {
    throw new Error('Contribution not found');
  }
  
  // Get list of members who haven't voted
  const votedMemberIds = request.votes.map(v => v.userId);
  const nonVotedMembers = contribution.members.filter(
    memberId => !votedMemberIds.includes(memberId) && hasContributed(memberId, contribution.id)
  );
  
  // Add reminder notification for each non-voted member
  nonVotedMembers.forEach(memberId => {
    addNotification({
      userId: memberId,
      message: `REMINDER: Please vote on the withdrawal request for ${contribution.name}. Deadline: ${new Date(request.deadline).toLocaleString()}`,
      type: 'warning',
      read: false,
      relatedId: requestId,
    });
  });
  
  // In a real app, this would also trigger SMS reminders
  console.log(`Reminders sent to ${nonVotedMembers.length} members for request ${requestId}`);
};

// Modify the voteOnWithdrawalRequest function to handle the new voting rules
export const voteOnWithdrawalRequest = (requestId: string, vote: 'approve' | 'reject'): WithdrawalRequest => {
  const requests = getWithdrawalRequests();
  const currentUser = getCurrentUser();
  
  const index = requests.findIndex(r => r.id === requestId);
  if (index >= 0) {
    // Check if the request is expired
    if (isWithdrawalRequestExpired(requests[index])) {
      throw new Error('This withdrawal request has expired');
    }
    
    // Check if user is eligible to vote
    if (!canVote(currentUser.id, requests[index].contributionId)) {
      throw new Error('You must contribute to this group before voting on withdrawal requests');
    }
    
    // Remove existing vote if any
    requests[index].votes = requests[index].votes.filter(v => v.userId !== currentUser.id);
    
    // Add new vote
    requests[index].votes.push({
      userId: currentUser.id,
      vote,
    });
    
    // Check if the voting rules are met
    const contribution = getContribution(requests[index].contributionId);
    if (contribution) {
      // Get the eligible voters (those who have contributed)
      const eligibleVoters = contribution.members.filter(memberId => 
        hasContributed(memberId, contribution.id)
      );
      
      const totalEligibleVoters = eligibleVoters.length;
      const votesCount = requests[index].votes.length;
      const participationPercentage = (votesCount / totalEligibleVoters) * 100;
      
      const approvalVotes = requests[index].votes.filter(v => v.vote === 'approve').length;
      const approvalPercentage = (approvalVotes / votesCount) * 100;
      
      // 50% participation threshold required
      if (participationPercentage >= 50) {
        // If 51% or more votes are for approval, approve the request
        if (approvalPercentage >= 51) {
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
        } else {
          // If less than 51% votes are for approval, reject the request
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
  return `${baseUrl}/contribute/share/${contributionId}`;
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

// Logout user
export const logoutUser = (): void => {
  localStorage.removeItem('currentUser');
};

// Initialize with empty data
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
  
  // Initialize admin account
  initializeAdmin();
};

// Function to generate a receipt for a contribution
export const generateContributionReceipt = (transactionId: string): { 
  contributionName: string;
  contributorName: string;
  amount: number;
  date: string;
  receiptNumber: string;
  accountNumber: string;
} | null => {
  const transactions = getTransactions();
  const transaction = transactions.find(t => t.id === transactionId);
  
  if (!transaction || transaction.type !== 'deposit') {
    return null;
  }
  
  const contribution = getContribution(transaction.contributionId);
  if (!contribution) {
    return null;
  }
  
  const user = getUserById(transaction.userId);
  
  return {
    contributionName: contribution.name,
    contributorName: transaction.anonymous ? 'Anonymous Contributor' : (user ? user.name : 'Unknown User'),
    amount: transaction.amount,
    date: transaction.createdAt,
    receiptNumber: transaction.id.substring(0, 8).toUpperCase(),
    accountNumber: contribution.accountNumber
  };
};

// Update expiry status of withdrawal requests
export const updateWithdrawalRequestsStatus = (): void => {
  const requests = getWithdrawalRequests();
  let updated = false;
  
  requests.forEach((request, index) => {
    // Only check pending requests
    if (request.status === 'pending') {
      // If request has expired
      if (isWithdrawalRequestExpired(request)) {
        const contribution = getContribution(request.contributionId);
        if (contribution) {
          // Get the eligible voters (those who have contributed)
          const eligibleVoters = contribution.members.filter(memberId => 
            hasContributed(memberId, contribution.id)
          );
          
          const totalEligibleVoters = eligibleVoters.length;
          const votesCount = request.votes.length;
          const participationPercentage = (votesCount / totalEligibleVoters) * 100;
          
          // If participation is less than 50%, keep waiting
          if (participationPercentage < 50) {
            // Request expired but not enough participation - do nothing yet
            console.log(`Request ${request.id} expired but only has ${participationPercentage.toFixed(2)}% participation`);
          } else {
            // Enough participation, determine result
            const approvalVotes = request.votes.filter(v => v.vote === 'approve').length;
            const approvalPercentage = (approvalVotes / votesCount) * 100;
            
            if (approvalPercentage >= 51) {
              requests[index].status = 'approved';
              
              // Update contribution amount
              const contributions = getContributions();
              const contribIndex = contributions.findIndex(c => c.id === contribution.id);
              contributions[contribIndex].currentAmount -= request.amount;
              localStorage.setItem('contributions', JSON.stringify(contributions));
              
              // Add transaction
              addTransaction({
                userId: request.requesterId,
                contributionId: contribution.id,
                type: 'withdrawal',
                amount: request.amount,
                status: 'completed',
                description: `Withdrawal for: ${request.purpose}`,
                createdAt: new Date().toISOString(),
                relatedId: request.id,
              });
              
              // Add notification
              addNotification({
                userId: request.requesterId,
                message: `Your withdrawal request of ₦${request.amount.toLocaleString()} was approved!`,
                type: 'success',
                read: false,
                relatedId: request.
