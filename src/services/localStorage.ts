import { User, Contribution, Transaction, WithdrawalRequest, Notification, Stats } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// User related functions
export const getCurrentUser = (): User => {
  const userString = localStorage.getItem('currentUser');
  if (!userString) {
    return {
      id: '',
      email: '',
      name: '',
      role: 'user',
      walletBalance: 0,
      verified: false,
      status: 'active',
      createdAt: new Date().toISOString(),
      preferences: {
        darkMode: false,
        notifications: true
      }
    };
  }
  return JSON.parse(userString);
};

export const setCurrentUser = (user: User): void => {
  localStorage.setItem('currentUser', JSON.stringify(user));
};

export const updateUser = (user: User): void => {
  const currentUser = getCurrentUser();
  if (currentUser.id === user.id) {
    setCurrentUser(user);
  }
  
  // Also update in the users array
  const usersString = localStorage.getItem('users');
  if (usersString) {
    const users: User[] = JSON.parse(usersString);
    const updatedUsers = users.map(u => u.id === user.id ? user : u);
    localStorage.setItem('users', JSON.stringify(updatedUsers));
  }
};

export const updateUserById = (userId: string, userData: Partial<User>): void => {
  // Update user in the users array
  const usersString = localStorage.getItem('users');
  if (usersString) {
    const users: User[] = JSON.parse(usersString);
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex >= 0) {
      users[userIndex] = { ...users[userIndex], ...userData };
      localStorage.setItem('users', JSON.stringify(users));
      
      // If it's the current user, also update current user
      const currentUser = getCurrentUser();
      if (currentUser.id === userId) {
        setCurrentUser({ ...currentUser, ...userData });
      }
    }
  }
};

export const updateUserBalance = (userId: string, amount: number, operation: 'add' | 'subtract'): User => {
  const currentUser = getCurrentUser();
  if (currentUser.id === userId) {
    const updatedUser = { 
      ...currentUser, 
      walletBalance: operation === 'add' 
        ? currentUser.walletBalance + amount 
        : Math.max(0, currentUser.walletBalance - amount)
    };
    setCurrentUser(updatedUser);
    
    // Also update in the users array
    updateUser(updatedUser);
    
    return updatedUser;
  }
  
  // If it's not the current user, update in the users array
  const usersString = localStorage.getItem('users');
  if (usersString) {
    const users: User[] = JSON.parse(usersString);
    const updatedUsers = users.map(user => {
      if (user.id === userId) {
        return { 
          ...user, 
          walletBalance: operation === 'add' 
            ? user.walletBalance + amount 
            : Math.max(0, user.walletBalance - amount)
        };
      }
      return user;
    });
    localStorage.setItem('users', JSON.stringify(updatedUsers));
    
    // Return the updated user
    return updatedUsers.find(user => user.id === userId) || currentUser;
  }
  
  return currentUser;
};

export const pauseUser = (userId: string): void => {
  updateUserById(userId, { status: 'paused' });
};

export const activateUser = (userId: string): void => {
  updateUserById(userId, { status: 'active' });
};

export const depositToUser = (userId: string, amount: number): void => {
  if (amount <= 0) return;
  
  // Add to user balance
  updateUserBalance(userId, amount, 'add');
  
  // Create transaction record
  const transaction: Transaction = {
    id: uuidv4(),
    userId: userId,
    type: 'deposit',
    amount: amount,
    description: 'Admin deposit',
    status: 'completed',
    createdAt: new Date().toISOString(),
  };
  
  addTransaction(transaction);
};

export const logoutUser = (): void => {
  localStorage.removeItem('currentUser');
};

export const getUsers = (): User[] => {
  const usersString = localStorage.getItem('users');
  if (!usersString) {
    return [];
  }
  return JSON.parse(usersString);
};

export const getUserByEmail = (email: string): User | null => {
  const users = getUsers();
  return users.find(user => user.email.toLowerCase() === email.toLowerCase()) || null;
};

export const getUserByPhone = (phone: string): User | null => {
  const users = getUsers();
  return users.find(user => 
    (user.phone && user.phone.toLowerCase() === phone.toLowerCase()) || 
    (user.phoneNumber && user.phoneNumber.toLowerCase() === phone.toLowerCase())
  ) || null;
};

export const createUser = (userData: Partial<User>): User => {
  const newUser: User = {
    id: uuidv4(),
    email: userData.email || '',
    name: userData.name || '',
    firstName: userData.firstName || '',
    lastName: userData.lastName || '',
    role: userData.role || 'user',
    walletBalance: userData.walletBalance || 0,
    verified: userData.verified || false,
    status: userData.status || 'active',
    createdAt: userData.createdAt || new Date().toISOString(),
    preferences: userData.preferences || {
      darkMode: false,
      notifications: true
    }
  };
  
  const users = getUsers();
  users.push(newUser);
  localStorage.setItem('users', JSON.stringify(users));
  
  return newUser;
};

export const verifyUserWithOTP = (userId: string): void => {
  updateUserById(userId, { verified: true });
};

// Contribution related functions
export const getContributions = (): Contribution[] => {
  const contributionsString = localStorage.getItem('contributions');
  if (!contributionsString) {
    return [];
  }
  return JSON.parse(contributionsString);
};

export const getUserContributions = (userId: string): Contribution[] => {
  const contributions = getContributions();
  return contributions.filter(contribution => 
    contribution.creatorId === userId || contribution.members.includes(userId)
  );
};

export const getContributionByAccountNumber = (accountNumber: string): Contribution | null => {
  const contributions = getContributions();
  return contributions.find(contribution => contribution.accountNumber === accountNumber) || null;
};

export const addContribution = (contribution: Contribution): void => {
  const contributions = getContributions();
  contributions.push(contribution);
  localStorage.setItem('contributions', JSON.stringify(contributions));
};

export const updateContribution = (contribution: Contribution): void => {
  const contributions = getContributions();
  const updatedContributions = contributions.map(c => 
    c.id === contribution.id ? contribution : c
  );
  localStorage.setItem('contributions', JSON.stringify(updatedContributions));
};

export const createContribution = (contributionData: Omit<Contribution, 'id' | 'createdAt' | 'currentAmount' | 'members' | 'contributors'>): Contribution => {
  const newContribution: Contribution = {
    id: uuidv4(),
    name: contributionData.name,
    description: contributionData.description,
    creatorId: contributionData.creatorId,
    goalAmount: contributionData.goalAmount,
    targetAmount: contributionData.targetAmount || contributionData.goalAmount,
    currentAmount: 0,
    status: contributionData.status || 'active',
    startDate: contributionData.startDate || new Date().toISOString(),
    endDate: contributionData.endDate,
    frequency: contributionData.frequency,
    createdAt: new Date().toISOString(),
    members: [contributionData.creatorId],
    contributors: [],
    public: contributionData.public || false,
    accountNumber: contributionData.accountNumber,
    accountName: contributionData.accountName,
    bankName: contributionData.bankName,
    votingThreshold: contributionData.votingThreshold || 50,
    category: contributionData.category
  };
  
  addContribution(newContribution);
  
  // Update stats
  updateStats({
    ...getStatistics(),
    totalContributions: getStatistics().totalContributions + 1,
    activeContributions: getStatistics().activeContributions + 1
  });
  
  return newContribution;
};

export const contributeToGroup = (contributionId: string, amount: number, anonymous: boolean = false): void => {
  const contributions = getContributions();
  const contributionIndex = contributions.findIndex(c => c.id === contributionId);
  
  if (contributionIndex < 0) {
    throw new Error('Contribution not found');
  }
  
  const currentUser = getCurrentUser();
  
  // Check if user has sufficient funds
  if (currentUser.walletBalance < amount) {
    throw new Error('Insufficient funds');
  }
  
  // Deduct from user's wallet
  updateUserBalance(currentUser.id, amount, 'subtract');
  
  // Add amount to contribution
  contributions[contributionIndex].currentAmount += amount;
  
  // Add user to members if not already a member
  if (!contributions[contributionIndex].members.includes(currentUser.id)) {
    contributions[contributionIndex].members.push(currentUser.id);
  }
  
  // Add to contributors list
  contributions[contributionIndex].contributors.push({
    userId: currentUser.id,
    name: currentUser.name || currentUser.email,
    amount: amount,
    date: new Date().toISOString(),
    anonymous: anonymous
  });
  
  localStorage.setItem('contributions', JSON.stringify(contributions));
  
  // Create transaction record
  const transaction: Transaction = {
    id: uuidv4(),
    userId: currentUser.id,
    type: 'transfer',
    amount: amount,
    contributionId: contributionId,
    description: `Contribution to ${contributions[contributionIndex].name}`,
    status: 'completed',
    createdAt: new Date().toISOString(),
  };
  
  addTransaction(transaction);
  
  // Update stats
  updateStats({
    ...getStatistics(),
    totalContributed: getStatistics().totalContributed + amount
  });
  
  // Create notification for contribution creator if not the same as contributor
  if (contributions[contributionIndex].creatorId !== currentUser.id) {
    addNotification({
      id: uuidv4(),
      userId: contributions[contributionIndex].creatorId,
      message: `${anonymous ? 'Anonymous' : currentUser.name || 'Someone'} contributed ₦${amount.toLocaleString()} to ${contributions[contributionIndex].name}`,
      type: 'success',
      read: false,
      createdAt: new Date().toISOString(),
      relatedId: contributionId
    });
  }
};

export const contributeByAccountNumber = (accountNumber: string, amount: number, contributorInfo: { name: string, email?: string, phone?: string }, anonymous: boolean = false): void => {
  const contribution = getContributionByAccountNumber(accountNumber);
  
  if (!contribution) {
    throw new Error('Invalid account number');
  }
  
  // Create pseudo-user for tracking
  let contributorId = '';
  const existingUser = contributorInfo.email 
    ? getUserByEmail(contributorInfo.email)
    : contributorInfo.phone 
      ? getUserByPhone(contributorInfo.phone) 
      : null;
  
  if (existingUser) {
    contributorId = existingUser.id;
  } else {
    // Create a temporary ID based on the info provided
    contributorId = `external_${uuidv4()}`;
  }
  
  // Add amount to contribution
  const contributions = getContributions();
  const contributionIndex = contributions.findIndex(c => c.id === contribution.id);
  
  if (contributionIndex < 0) {
    throw new Error('Contribution not found');
  }
  
  contributions[contributionIndex].currentAmount += amount;
  
  // Add to contributors list
  contributions[contributionIndex].contributors.push({
    userId: contributorId,
    name: contributorInfo.name,
    amount: amount,
    date: new Date().toISOString(),
    anonymous: anonymous
  });
  
  localStorage.setItem('contributions', JSON.stringify(contributions));
  
  // Create transaction record for tracking
  const transaction: Transaction = {
    id: uuidv4(),
    userId: contributorId,
    type: 'deposit',
    amount: amount,
    contributionId: contribution.id,
    description: `External contribution to ${contribution.name} via account number`,
    status: 'completed',
    createdAt: new Date().toISOString(),
  };
  
  addTransaction(transaction);
  
  // Update stats
  updateStats({
    ...getStatistics(),
    totalContributed: getStatistics().totalContributed + amount
  });
  
  // Create notification for contribution creator
  addNotification({
    id: uuidv4(),
    userId: contribution.creatorId,
    message: `${anonymous ? 'Anonymous' : contributorInfo.name} contributed ₦${amount.toLocaleString()} to ${contribution.name} via account number`,
    type: 'success',
    read: false,
    createdAt: new Date().toISOString(),
    relatedId: contribution.id
  });
};

export const generateShareLink = (contributionId: string): string => {
  return `${window.location.origin}/contribute/share/${contributionId}`;
};

// Transaction related functions
export const getTransactions = (): Transaction[] => {
  const transactionsString = localStorage.getItem('transactions');
  if (!transactionsString) {
    return [];
  }
  return JSON.parse(transactionsString);
};

export const addTransaction = (transaction: Transaction): void => {
  const transactions = getTransactions();
  // Check if transaction already exists
  if (!transactions.some(t => t.id === transaction.id)) {
    transactions.push(transaction);
    localStorage.setItem('transactions', JSON.stringify(transactions));
  }
};

// Withdrawal request related functions
export const getWithdrawalRequests = (): WithdrawalRequest[] => {
  const requestsString = localStorage.getItem('withdrawalRequests');
  if (!requestsString) {
    return [];
  }
  return JSON.parse(requestsString);
};

export const addWithdrawalRequest = (request: WithdrawalRequest): void => {
  const requests = getWithdrawalRequests();
  requests.push(request);
  localStorage.setItem('withdrawalRequests', JSON.stringify(requests));
};

export const updateWithdrawalRequest = (request: WithdrawalRequest): void => {
  const requests = getWithdrawalRequests();
  const updatedRequests = requests.map(r => 
    r.id === request.id ? request : r
  );
  localStorage.setItem('withdrawalRequests', JSON.stringify(updatedRequests));
};

export const createWithdrawalRequest = (requestData: Omit<WithdrawalRequest, 'id' | 'createdAt' | 'status' | 'votes' | 'deadline'>): WithdrawalRequest => {
  // Set deadline to 3 days from now
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 3);
  
  const newRequest: WithdrawalRequest = {
    id: uuidv4(),
    contributionId: requestData.contributionId,
    requesterId: requestData.requesterId,
    amount: requestData.amount,
    purpose: requestData.purpose,
    status: 'pending',
    createdAt: new Date().toISOString(),
    deadline: deadline.toISOString(),
    votes: []
  };
  
  addWithdrawalRequest(newRequest);
  
  // Get the contribution to find all members
  const contribution = getContributions().find(c => c.id === requestData.contributionId);
  
  // Send notification to all members except the requester
  if (contribution) {
    contribution.members.forEach(memberId => {
      if (memberId !== requestData.requesterId) {
        addNotification({
          id: uuidv4(),
          userId: memberId,
          message: `New withdrawal request from ${contribution.name}`,
          type: 'info',
          read: false,
          createdAt: new Date().toISOString(),
          relatedId: newRequest.id
        });
      }
    });
  }
  
  return newRequest;
};

export const voteOnWithdrawalRequest = (requestId: string, vote: 'approve' | 'reject'): void => {
  const requests = getWithdrawalRequests();
  const requestIndex = requests.findIndex(r => r.id === requestId);
  
  if (requestIndex < 0) {
    throw new Error('Withdrawal request not found');
  }
  
  const currentUser = getCurrentUser();
  
  // Get the contribution
  const contribution = getContributions().find(c => c.id === requests[requestIndex].contributionId);
  
  if (!contribution) {
    throw new Error('Associated contribution not found');
  }
  
  // Check if user is a member of the contribution
  if (!contribution.members.includes(currentUser.id)) {
    throw new Error('You are not a member of this contribution group');
  }
  
  // Check if user has contributed
  const hasContributed = contribution.contributors.some(c => c.userId === currentUser.id);
  
  if (!hasContributed) {
    throw new Error('You need to contribute to the group before voting');
  }
  
  // Check if user has already voted
  const hasVoted = requests[requestIndex].votes.some(v => v.userId === currentUser.id);
  
  if (hasVoted) {
    // Update existing vote
    requests[requestIndex].votes = requests[requestIndex].votes.map(v => 
      v.userId === currentUser.id ? { ...v, vote, date: new Date().toISOString() } : v
    );
  } else {
    // Add new vote
    requests[requestIndex].votes.push({
      userId: currentUser.id,
      vote,
      date: new Date().toISOString()
    });
  }
  
  // Check if threshold is reached for approval
  const approvalVotes = requests[requestIndex].votes.filter(v => v.vote === 'approve').length;
  const contributorsCount = contribution.contributors.length;
  const votingThreshold = contribution.votingThreshold || 50; // Default to 50%
  
  // Create transaction for the vote (for record keeping)
  const transaction: Transaction = {
    id: uuidv4(),
    userId: currentUser.id,
    type: 'vote',
    amount: 0,
    contributionId: contribution.id,
    description: `Vote ${vote === 'approve' ? 'approved' : 'rejected'} for withdrawal request`,
    status: 'completed',
    createdAt: new Date().toISOString(),
    metaData: {
      requestId: requestId,
      vote: vote
    }
  };
  
  addTransaction(transaction);
  
  // Calculate the percentage of approval votes
  const approvalPercentage = (approvalVotes / contributorsCount) * 100;
  
  // Auto approve if threshold is reached
  if (approvalPercentage >= votingThreshold) {
    requests[requestIndex].status = 'approved';
    
    // Create notification for requester
    addNotification({
      id: uuidv4(),
      userId: requests[requestIndex].requesterId,
      message: `Your withdrawal request for ₦${requests[requestIndex].amount.toLocaleString()} has been approved`,
      type: 'success',
      read: false,
      createdAt: new Date().toISOString(),
      relatedId: requestId
    });
    
    // Deduct from contribution amount
    const contributions = getContributions();
    const contributionIndex = contributions.findIndex(c => c.id === contribution.id);
    
    if (contributionIndex >= 0) {
      contributions[contributionIndex].currentAmount -= requests[requestIndex].amount;
      localStorage.setItem('contributions', JSON.stringify(contributions));
      
      // Create transaction for the withdrawal
      const withdrawalTransaction: Transaction = {
        id: uuidv4(),
        userId: requests[requestIndex].requesterId,
        type: 'withdrawal',
        amount: requests[requestIndex].amount,
        contributionId: contribution.id,
        description: `Withdrawal from ${contribution.name}: ${requests[requestIndex].purpose}`,
        status: 'completed',
        createdAt: new Date().toISOString(),
        metaData: {
          requestId: requestId
        }
      };
      
      addTransaction(withdrawalTransaction);
    }
  }
  
  localStorage.setItem('withdrawalRequests', JSON.stringify(requests));
};

export const updateWithdrawalRequestsStatus = (): void => {
  const requests = getWithdrawalRequests();
  const now = new Date();
  
  let updated = false;
  
  // Check for expired requests
  const updatedRequests = requests.map(request => {
    if (request.status === 'pending' && new Date(request.deadline) < now) {
      updated = true;
      return { ...request, status: 'expired' };
    }
    return request;
  });
  
  if (updated) {
    localStorage.setItem('withdrawalRequests', JSON.stringify(updatedRequests));
  }
};

export const pingGroupMembersForVote = (requestId: string): void => {
  const request = getWithdrawalRequests().find(r => r.id === requestId);
  
  if (!request) {
    throw new Error('Withdrawal request not found');
  }
  
  const contribution = getContributions().find(c => c.id === request.contributionId);
  
  if (!contribution) {
    throw new Error('Associated contribution not found');
  }
  
  // Get all members who haven't voted yet
  const nonVoters = contribution.members.filter(memberId => 
    !request.votes.some(vote => vote.userId === memberId)
  );
  
  // Send reminder notification to all non-voters
  nonVoters.forEach(memberId => {
    addNotification({
      id: uuidv4(),
      userId: memberId,
      message: `Reminder: Please vote on the withdrawal request for ${contribution.name}`,
      type: 'info',
      read: false,
      createdAt: new Date().toISOString(),
      relatedId: requestId
    });
  });
};

export const generateContributionReceipt = (transactionId: string): any => {
  const transaction = getTransactions().find(t => t.id === transactionId);
  
  if (!transaction) {
    return null;
  }
  
  // Get related contribution if exists
  let contribution = null;
  if (transaction.contributionId) {
    contribution = getContributions().find(c => c.id === transaction.contributionId);
  }
  
  // Get user info
  const user = getUsers().find(u => u.id === transaction.userId) || {
    name: 'Anonymous',
    email: 'anonymous@user.com'
  };
  
  // Format current date
  const formatter = new Intl.DateTimeFormat('en-NG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return {
    receiptId: `RCP-${transaction.id.substring(0, 8)}`,
    transactionId: transaction.id,
    date: formatter.format(new Date(transaction.createdAt)),
    type: transaction.type,
    amount: transaction.amount,
    description: transaction.description,
    status: transaction.status,
    user: {
      name: user.name,
      email: user.email
    },
    contribution: contribution ? {
      name: contribution.name,
      id: contribution.id
    } : null
  };
};

// Notification related functions
export const getNotifications = (): Notification[] => {
  const notificationsString = localStorage.getItem('notifications');
  if (!notificationsString) {
    return [];
  }
  return JSON.parse(notificationsString);
};

export const addNotification = (notification: Partial<Notification>): void => {
  const notifications = getNotifications();
  const newNotification: Notification = {
    id: notification.id || uuidv4(),
    userId: notification.userId || '',
    message: notification.message || '',
    type: notification.type || 'info',
    read: notification.read || false,
    createdAt: notification.createdAt || new Date().toISOString(),
    relatedId: notification.relatedId
  };
  
  notifications.push(newNotification);
  localStorage.setItem('notifications', JSON.stringify(notifications));
};

export const updateNotification = (notification: Notification): void => {
  const notifications = getNotifications();
  const updatedNotifications = notifications.map(n => 
    n.id === notification.id ? notification : n
  );
  localStorage.setItem('notifications', JSON.stringify(updatedNotifications));
};

export const markNotificationAsRead = (notificationId: string): void => {
  const notifications = getNotifications();
  const updatedNotifications = notifications.map(n => 
    n.id === notificationId ? { ...n, read: true } : n
  );
  localStorage.setItem('notifications', JSON.stringify(updatedNotifications));
};

export const markAllNotificationsAsRead = (userId: string): void => {
  const notifications = getNotifications();
  const updatedNotifications = notifications.map(n => 
    n.userId === userId ? { ...n, read: true } : n
  );
  localStorage.setItem('notifications', JSON.stringify(updatedNotifications));
};

export const clearAllNotifications = (userId: string): void => {
  const notifications = getNotifications();
  const otherNotifications = notifications.filter(n => n.userId !== userId);
  localStorage.setItem('notifications', JSON.stringify(otherNotifications));
};

// Stats related functions
export const getStatistics = (): Stats => {
  const statsString = localStorage.getItem('stats');
  if (!statsString) {
    return {
      totalContributions: 0,
      activeContributions: 0,
      totalContributed: 0,
      totalMembers: 0
    };
  }
  return JSON.parse(statsString);
};

// Export alias for getStatistics
export const getStats = getStatistics;

export const updateStats = (stats: Stats): void => {
  localStorage.setItem('stats', JSON.stringify(stats));
};

// Helper functions to initialize data if empty
export const initializeLocalStorageIfEmpty = (): void => {
  // Initialize users
  if (!localStorage.getItem('users')) {
    localStorage.setItem('users', JSON.stringify([]));
  }
  
  // Initialize contributions
  if (!localStorage.getItem('contributions')) {
    localStorage.setItem('contributions', JSON.stringify([]));
  }
  
  // Initialize transactions
  if (!localStorage.getItem('transactions')) {
    localStorage.setItem('transactions', JSON.stringify([]));
  }
  
  // Initialize withdrawal requests
  if (!localStorage.getItem('withdrawalRequests')) {
    localStorage.setItem('withdrawalRequests', JSON.stringify([]));
  }
  
  // Initialize notifications
  if (!localStorage.getItem('notifications')) {
    localStorage.setItem('notifications', JSON.stringify([]));
  }
  
  // Initialize stats
  if (!localStorage.getItem('stats')) {
    localStorage.setItem('stats', JSON.stringify({
      totalContributions: 0,
      activeContributions: 0,
      totalContributed: 0,
      totalMembers: 0
    }));
  }
};

// Create default admin account if not exists
export const createDefaultAdminIfNotExists = (): void => {
  const usersString = localStorage.getItem('users');
  let users: User[] = [];
  
  if (usersString) {
    users = JSON.parse(usersString);
  }
  
  // Check if admin exists
  const adminExists = users.some(user => user.role === 'admin');
  
  if (!adminExists) {
    const adminUser: User = {
      id: uuidv4(),
      email: 'admin@collectipay.com',
      name: 'Admin User',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      walletBalance: 0,
      verified: true,
      status: 'active',
      createdAt: new Date().toISOString(),
      preferences: {
        darkMode: false,
        notifications: true
      }
    };
    
    users.push(adminUser);
    localStorage.setItem('users', JSON.stringify(users));
  }
};

// Initialize localStorage
export const initializeLocalStorage = (): void => {
  initializeLocalStorageIfEmpty();
  createDefaultAdminIfNotExists();
};
