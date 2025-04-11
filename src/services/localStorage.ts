
import { isValid } from "date-fns";

export interface User {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  walletBalance: number;
  role: 'user' | 'admin';
  status: 'active' | 'paused';
  verified: boolean;
  pin?: string;
  createdAt: string;
  preferences?: {
    darkMode: boolean;
    notifications: boolean;
  };
  notifications?: Array<{
    id: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    read: boolean;
    createdAt: string;
    relatedId?: string;
  }>;
  reservedAccount?: any;
  cardTokens?: Array<any>;
  invoices?: Array<any>;
}

export interface Contribution {
  id: string;
  name: string;
  description: string;
  targetAmount: number;
  goalDate?: string;
  currentAmount: number;
  creatorId: string;
  createdAt: string;
  members: string[];
  contributors: Array<{
    userId: string;
    name: string;
    amount: number;
    date: string;
    anonymous: boolean;
  }>;
  type: 'one-time' | 'recurring';
  frequency?: 'daily' | 'weekly' | 'monthly';
  accountNumber?: string;
  bankName?: string;
  bankCode?: string;
  accountReference?: string;
  reservationReference?: string;
}

export interface WithdrawalRequest {
  id: string;
  contributionId: string;
  amount: number;
  reason: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  votes: Array<{
    userId: string;
    vote: 'approve' | 'reject';
    date: string;
  }>;
  deadline: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'deposit' | 'withdrawal' | 'transfer' | 'vote';
  amount: number;
  contributionId: string;
  description: string;
  status: 'completed' | 'pending' | 'failed';
  createdAt: string;
  metaData?: any;
}

export interface Stats {
  totalContributions: number;
  totalAmountContributed: number;
  successfulWithdrawals: number;
  totalMembers: number;
}

// Initialize localStorage with default values if needed
export const initializeLocalStorage = (): void => {
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
};

// Get functions
export const getUsers = (): User[] => {
  const users = localStorage.getItem('users');
  return users ? JSON.parse(users) : [];
};

export const getCurrentUser = (): User => {
  const currentUser = localStorage.getItem('currentUser');
  return currentUser ? JSON.parse(currentUser) : null;
};

export const getContributions = (): Contribution[] => {
  const contributions = localStorage.getItem('contributions');
  return contributions ? JSON.parse(contributions) : [];
};

export const getUserContributions = (userId: string): Contribution[] => {
  const allContributions = getContributions();
  return allContributions.filter(contribution => 
    contribution.creatorId === userId || contribution.members.includes(userId)
  );
};

export const getWithdrawalRequests = (): WithdrawalRequest[] => {
  const requests = localStorage.getItem('withdrawalRequests');
  return requests ? JSON.parse(requests) : [];
};

export const getTransactions = (): Transaction[] => {
  const transactions = localStorage.getItem('transactions');
  return transactions ? JSON.parse(transactions) : [];
};

export const getStatistics = (): Stats => {
  const contributions = getContributions();
  const withdrawalRequests = getWithdrawalRequests();
  
  const totalContributions = contributions.length;
  
  let totalAmountContributed = 0;
  let totalMembers = new Set();
  
  contributions.forEach(contribution => {
    totalAmountContributed += contribution.currentAmount;
    totalMembers.add(contribution.creatorId);
    contribution.members.forEach(member => totalMembers.add(member));
  });
  
  const successfulWithdrawals = withdrawalRequests.filter(
    request => request.status === 'approved'
  ).length;
  
  return {
    totalContributions,
    totalAmountContributed,
    successfulWithdrawals,
    totalMembers: totalMembers.size
  };
};

// Update functions
export const updateUser = (userData: Partial<User> & { id?: string }): void => {
  const currentUser = getCurrentUser();
  
  if (!currentUser) {
    console.error('No current user to update');
    return;
  }
  
  const updatedUser = { ...currentUser, ...userData };
  localStorage.setItem('currentUser', JSON.stringify(updatedUser));
  
  // Also update in users array
  const users = getUsers();
  const userIndex = users.findIndex(u => u.id === currentUser.id);
  
  if (userIndex >= 0) {
    users[userIndex] = { ...users[userIndex], ...userData };
    localStorage.setItem('users', JSON.stringify(users));
  }
};

export const updateUserById = (userId: string, userData: Partial<User>): void => {
  const users = getUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex >= 0) {
    users[userIndex] = { ...users[userIndex], ...userData };
    localStorage.setItem('users', JSON.stringify(users));
    
    // If this is the current user, also update currentUser
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      updateUser(userData);
    }
  }
};

export const updateUserBalance = (userId: string, amount: number, add: boolean = true): void => {
  const users = getUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex >= 0) {
    const user = users[userIndex];
    const currentBalance = user.walletBalance || 0;
    const newBalance = add ? currentBalance + amount : amount;
    
    user.walletBalance = newBalance;
    users[userIndex] = user;
    localStorage.setItem('users', JSON.stringify(users));
    
    // If this is the current user, also update currentUser
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      currentUser.walletBalance = newBalance;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    }
  }
};

export const updateContribution = (contribution: Contribution): void => {
  const contributions = getContributions();
  const index = contributions.findIndex(c => c.id === contribution.id);
  
  if (index >= 0) {
    contributions[index] = contribution;
    localStorage.setItem('contributions', JSON.stringify(contributions));
  }
};

// User management functions
export const pauseUser = (userId: string): void => {
  updateUserById(userId, { status: 'paused' });
};

export const activateUser = (userId: string): void => {
  updateUserById(userId, { status: 'active' });
};

export const depositToUser = (userId: string, amount: number): void => {
  updateUserBalance(userId, amount, true);
  
  // Create a transaction record
  addTransaction({
    id: `tr_${Date.now()}`,
    userId,
    type: 'deposit',
    amount,
    contributionId: "",
    description: "Admin deposit",
    status: 'completed',
    createdAt: new Date().toISOString()
  });
};

export const logoutUser = (): void => {
  localStorage.removeItem('currentUser');
};

// Contribution functions
export const createContribution = (contribution: Omit<Contribution, 'id' | 'createdAt' | 'currentAmount' | 'members' | 'contributors' | 'accountNumber'>): Contribution => {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('Not logged in');
  
  const contributions = getContributions();
  
  const newContribution: Contribution = {
    id: `c_${Date.now()}`,
    ...contribution,
    currentAmount: 0,
    creatorId: currentUser.id,
    createdAt: new Date().toISOString(),
    members: [currentUser.id],
    contributors: [],
    accountNumber: '', // This will be set when creating a reserved account
  };
  
  contributions.push(newContribution);
  localStorage.setItem('contributions', JSON.stringify(contributions));
  
  return newContribution;
};

export const contributeToGroup = (contributionId: string, amount: number, anonymous: boolean = false): void => {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('Not logged in');
  
  if (currentUser.walletBalance < amount) {
    throw new Error('Insufficient funds');
  }
  
  // Deduct from wallet
  updateUserBalance(currentUser.id, amount, false);
  
  // Add to contribution
  const contributions = getContributions();
  const index = contributions.findIndex(c => c.id === contributionId);
  
  if (index < 0) {
    throw new Error('Contribution not found');
  }
  
  const contribution = contributions[index];
  
  // Add to current amount
  contribution.currentAmount += amount;
  
  // Add to contributors
  contribution.contributors.push({
    userId: currentUser.id,
    name: anonymous ? 'Anonymous' : currentUser.name || `${currentUser.firstName} ${currentUser.lastName}`,
    amount,
    date: new Date().toISOString(),
    anonymous
  });
  
  // Add user to members if not already there
  if (!contribution.members.includes(currentUser.id)) {
    contribution.members.push(currentUser.id);
  }
  
  // Save changes
  contributions[index] = contribution;
  localStorage.setItem('contributions', JSON.stringify(contributions));
  
  // Create transaction record
  addTransaction({
    id: `tr_${Date.now()}`,
    userId: currentUser.id,
    type: 'deposit',
    amount,
    contributionId,
    description: `Contribution to ${contribution.name}`,
    status: 'completed',
    createdAt: new Date().toISOString()
  });
};

export const contributeByAccountNumber = (accountNumber: string, amount: number, contributorInfo: { name: string, email?: string, phone?: string }, anonymous: boolean = false, paymentReference?: string): void => {
  // Find contribution by account number
  const contributions = getContributions();
  const contribution = contributions.find(c => c.accountNumber === accountNumber);
  
  if (!contribution) {
    throw new Error('Invalid account number');
  }
  
  const transactionId = `tr_${paymentReference || Date.now()}`;
  
  // Current user if available (not required for external contributions)
  const currentUser = getCurrentUser();
  const userId = currentUser?.id || `external_${Date.now()}`;
  
  // Add to current amount
  contribution.currentAmount += amount;
  
  // Add to contributors
  contribution.contributors.push({
    userId: userId,
    name: anonymous ? 'Anonymous' : contributorInfo.name,
    amount,
    date: new Date().toISOString(),
    anonymous
  });
  
  // Add user to members if signed in and not already there
  if (currentUser && !contribution.members.includes(currentUser.id)) {
    contribution.members.push(currentUser.id);
  }
  
  // Save changes
  const index = contributions.findIndex(c => c.id === contribution.id);
  contributions[index] = contribution;
  localStorage.setItem('contributions', JSON.stringify(contributions));
  
  // Create transaction record
  if (currentUser) {
    addTransaction({
      id: transactionId,
      userId: currentUser.id,
      type: 'deposit',
      amount,
      contributionId: contribution.id,
      description: `Contribution to ${contribution.name} via account transfer`,
      status: 'completed',
      createdAt: new Date().toISOString(),
      metaData: {
        method: 'bank_transfer',
        reference: paymentReference
      }
    });
  } else {
    // External contribution
    addTransaction({
      id: transactionId,
      userId: userId,
      type: 'deposit',
      amount,
      contributionId: contribution.id,
      description: `External contribution to ${contribution.name} via account transfer`,
      status: 'completed',
      createdAt: new Date().toISOString(),
      metaData: {
        method: 'bank_transfer',
        reference: paymentReference,
        contributorName: contributorInfo.name,
        contributorEmail: contributorInfo.email,
        contributorPhone: contributorInfo.phone
      }
    });
  }
};

export const getContributionByAccountNumber = (accountNumber: string): Contribution | null => {
  const contributions = getContributions();
  return contributions.find(c => c.accountNumber === accountNumber) || null;
};

// Withdrawal functions
export const createWithdrawalRequest = (request: Omit<WithdrawalRequest, 'id' | 'createdAt' | 'status' | 'votes' | 'deadline'>): void => {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('Not logged in');
  
  const withdrawalRequests = getWithdrawalRequests();
  
  // Create new withdrawal request
  const newRequest: WithdrawalRequest = {
    id: `wr_${Date.now()}`,
    ...request,
    createdAt: new Date().toISOString(),
    status: 'pending',
    votes: [{
      userId: currentUser.id,
      vote: 'approve',
      date: new Date().toISOString()
    }],
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
  };
  
  withdrawalRequests.push(newRequest);
  localStorage.setItem('withdrawalRequests', JSON.stringify(withdrawalRequests));
  
  // Add transaction record for the vote
  addTransaction({
    id: `tr_${Date.now()}`,
    userId: currentUser.id,
    type: 'vote',
    amount: 0,
    contributionId: request.contributionId,
    description: `Voted to approve withdrawal of ${request.amount} from group`,
    status: 'completed',
    createdAt: new Date().toISOString()
  });
};

export const voteOnWithdrawalRequest = (requestId: string, vote: 'approve' | 'reject'): void => {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('Not logged in');
  
  const withdrawalRequests = getWithdrawalRequests();
  const requestIndex = withdrawalRequests.findIndex(r => r.id === requestId);
  
  if (requestIndex < 0) {
    throw new Error('Withdrawal request not found');
  }
  
  const request = withdrawalRequests[requestIndex];
  
  // Check if already voted
  if (request.votes.some(v => v.userId === currentUser.id)) {
    throw new Error('You have already voted on this request');
  }
  
  // Check if user is part of the contribution
  const contributions = getContributions();
  const contribution = contributions.find(c => c.id === request.contributionId);
  
  if (!contribution) {
    throw new Error('Contribution not found');
  }
  
  if (!contribution.members.includes(currentUser.id)) {
    throw new Error('You are not a member of this contribution group');
  }
  
  // Check if user has contributed enough to vote
  const hasContributed = contribution.contributors.some(c => c.userId === currentUser.id);
  
  if (!hasContributed) {
    throw new Error('You must contribute to this group before voting on withdrawals');
  }
  
  // Add vote
  request.votes.push({
    userId: currentUser.id,
    vote,
    date: new Date().toISOString()
  });
  
  // Check if request should be approved or rejected
  const totalVotes = request.votes.length;
  const approveVotes = request.votes.filter(v => v.vote === 'approve').length;
  const rejectVotes = request.votes.filter(v => v.vote === 'reject').length;
  
  // If more than 50% of members have voted and more approve than reject, approve
  if (approveVotes > rejectVotes && approveVotes > contribution.members.length / 2) {
    request.status = 'approved';
    
    // Subtract from contribution
    const contributionIndex = contributions.findIndex(c => c.id === request.contributionId);
    if (contributionIndex >= 0) {
      contributions[contributionIndex].currentAmount -= request.amount;
      localStorage.setItem('contributions', JSON.stringify(contributions));
    }
    
    // Add to creator's wallet
    const users = getUsers();
    const creatorIndex = users.findIndex(u => u.id === contribution.creatorId);
    
    if (creatorIndex >= 0) {
      const creator = users[creatorIndex];
      creator.walletBalance = (creator.walletBalance || 0) + request.amount;
      users[creatorIndex] = creator;
      localStorage.setItem('users', JSON.stringify(users));
      
      // Update current user if the creator
      if (currentUser.id === creator.id) {
        currentUser.walletBalance = creator.walletBalance;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
      }
    }
    
    // Create transaction
    addTransaction({
      id: `tr_${Date.now()}`,
      userId: contribution.creatorId,
      type: 'withdrawal',
      amount: request.amount,
      contributionId: request.contributionId,
      description: `Withdrawal from ${contribution.name}`,
      status: 'completed',
      createdAt: new Date().toISOString()
    });
  } else if (rejectVotes > contribution.members.length / 2) {
    // If more than 50% of members have rejected, reject
    request.status = 'rejected';
  }
  
  // Save changes
  withdrawalRequests[requestIndex] = request;
  localStorage.setItem('withdrawalRequests', JSON.stringify(withdrawalRequests));
  
  // Add transaction record for the vote
  addTransaction({
    id: `tr_${Date.now()}`,
    userId: currentUser.id,
    type: 'vote',
    amount: 0,
    contributionId: request.contributionId,
    description: `Voted to ${vote} withdrawal of ${request.amount} from group`,
    status: 'completed',
    createdAt: new Date().toISOString()
  });
};

export const updateWithdrawalRequestsStatus = (): void => {
  const withdrawalRequests = getWithdrawalRequests();
  let updated = false;
  
  withdrawalRequests.forEach((request, index) => {
    if (request.status === 'pending') {
      const deadline = new Date(request.deadline);
      const now = new Date();
      
      if (now > deadline) {
        request.status = 'expired';
        withdrawalRequests[index] = request;
        updated = true;
      }
    }
  });
  
  if (updated) {
    localStorage.setItem('withdrawalRequests', JSON.stringify(withdrawalRequests));
  }
};

// Utility functions
export const generateShareLink = (contributionId: string): string => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/contribute/share/${contributionId}`;
};

export const addNotification = (notification: {
  userId: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  relatedId?: string;
}): void => {
  const users = getUsers();
  const userIndex = users.findIndex(u => u.id === notification.userId);
  
  if (userIndex >= 0) {
    const user = users[userIndex];
    const notifications = user.notifications || [];
    
    const newNotification = {
      id: `n_${Date.now()}`,
      ...notification,
      createdAt: new Date().toISOString()
    };
    
    notifications.push(newNotification);
    user.notifications = notifications;
    users[userIndex] = user;
    
    localStorage.setItem('users', JSON.stringify(users));
    
    // Update current user if it's the same
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.id === notification.userId) {
      currentUser.notifications = notifications;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    }
  }
};

export const markNotificationAsRead = (notificationId: string): void => {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.notifications) return;
  
  const notificationIndex = currentUser.notifications.findIndex(n => n.id === notificationId);
  if (notificationIndex >= 0) {
    currentUser.notifications[notificationIndex].read = true;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // Also update in users array
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === currentUser.id);
    if (userIndex >= 0) {
      const user = users[userIndex];
      if (user.notifications) {
        const userNotificationIndex = user.notifications.findIndex(n => n.id === notificationId);
        if (userNotificationIndex >= 0) {
          user.notifications[userNotificationIndex].read = true;
          users[userIndex] = user;
          localStorage.setItem('users', JSON.stringify(users));
        }
      }
    }
  }
};

export const markAllNotificationsAsRead = (): void => {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.notifications) return;
  
  currentUser.notifications.forEach(n => n.read = true);
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
  
  // Also update in users array
  const users = getUsers();
  const userIndex = users.findIndex(u => u.id === currentUser.id);
  if (userIndex >= 0) {
    const user = users[userIndex];
    if (user.notifications) {
      user.notifications.forEach(n => n.read = true);
      users[userIndex] = user;
      localStorage.setItem('users', JSON.stringify(users));
    }
  }
};

export const getUserByEmail = (email: string): User | null => {
  const users = getUsers();
  return users.find(u => u.email === email) || null;
};

export const getUserByPhone = (phone: string): User | null => {
  const users = getUsers();
  return users.find(u => u.phone === phone) || null;
};

export const pingGroupMembersForVote = (requestId: string): void => {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  
  const withdrawalRequests = getWithdrawalRequests();
  const request = withdrawalRequests.find(r => r.id === requestId);
  
  if (!request) {
    throw new Error('Withdrawal request not found');
  }
  
  // Check if user is the creator
  const contributions = getContributions();
  const contribution = contributions.find(c => c.id === request.contributionId);
  
  if (!contribution) {
    throw new Error('Contribution not found');
  }
  
  if (contribution.creatorId !== currentUser.id) {
    throw new Error('Only the creator can send reminders');
  }
  
  // Get member IDs who have not voted
  const votedUserIds = request.votes.map(v => v.userId);
  const nonVotedUserIds = contribution.members.filter(id => !votedUserIds.includes(id));
  
  // Send notification to each non-voted member
  nonVotedUserIds.forEach(userId => {
    addNotification({
      userId,
      message: `Reminder: Your vote is needed for a withdrawal request in ${contribution.name}`,
      type: 'info',
      read: false,
      relatedId: request.contributionId
    });
  });
};

export const generateContributionReceipt = (transactionId: string): any => {
  const transactions = getTransactions();
  const transaction = transactions.find(t => t.id === transactionId);
  
  if (!transaction) {
    return null;
  }
  
  // Get contribution details
  let contributionName = 'N/A';
  if (transaction.contributionId) {
    const contributions = getContributions();
    const contribution = contributions.find(c => c.id === transaction.contributionId);
    if (contribution) {
      contributionName = contribution.name;
    }
  }
  
  // Get user details
  const users = getUsers();
  const user = users.find(u => u.id === transaction.userId);
  
  return {
    receiptId: `RCP_${transactionId}`,
    transactionId,
    date: transaction.createdAt,
    amount: transaction.amount,
    description: transaction.description,
    contributionName,
    status: transaction.status,
    userName: user ? user.name || `${user.firstName} ${user.lastName}` : 'Unknown User',
    userEmail: user ? user.email : 'N/A',
    generatedAt: new Date().toISOString()
  };
};

// Helper to check if user has contributed to a group
export const hasContributed = (userId: string, contributionId: string): boolean => {
  const contributions = getContributions();
  const contribution = contributions.find(c => c.id === contributionId);
  
  if (!contribution) return false;
  
  return contribution.contributors.some(c => c.userId === userId);
};

// Transaction functions
export const addTransaction = (transaction: Transaction): void => {
  const transactions = getTransactions();
  transactions.push(transaction);
  localStorage.setItem('transactions', JSON.stringify(transactions));
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

// Add the OTP verification function 
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
