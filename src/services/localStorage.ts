import { v4 as uuidv4 } from 'uuid';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'user' | 'admin';
  walletBalance: number;
  pin: string;
  accountNumber: string;
  bvn: string;
  notifications: Notification[];
  preferences: {
    darkMode: boolean;
  };
  reservedAccount?: {
    accountReference: string;
    accountName: string;
    accountNumber: string;
    bankName: string;
  };
  verified: boolean;
  otp?: string;
}

export interface Contribution {
  id: string;
  name: string;
  description: string;
  targetAmount: number;
  currentAmount: number;
  startDate: string;
  endDate: string;
  creatorId: string;
  createdAt: string;
  members: string[];
  contributors: {
    userId: string;
    amount: number;
    anonymous: boolean;
  }[];
  accountNumber: string;
}

export interface WithdrawalRequest {
  id: string;
  contributionId: string;
  amount: number;
  recipientAccountName: string;
  recipientAccountNumber: string;
  recipientBankName: string;
  status: 'pending' | 'approved' | 'rejected';
  votes: {
    userId: string;
    vote: 'approve' | 'reject';
  }[];
  createdAt: string;
  deadline: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'deposit' | 'withdrawal' | 'vote';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  description: string;
  createdAt: string;
  contributionId?: string;
  contributionName?: string;
  reference?: string;
  senderName?: string;
  receiverName?: string;
  receiverBank?: string;
  receiverAccount?: string;
  fee?: number;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  type: 'info' | 'warning' | 'error';
  read: boolean;
  createdAt?: string;
  relatedId?: string;
}

export interface Stats {
  totalUsers: number;
  totalContributions: number;
  totalAmountContributed: number;
  totalWithdrawals: number;
}

// Helper functions
const generateId = (): string => uuidv4();

// User functions
export const createUser = (user: Omit<User, 'id' | 'walletBalance' | 'role' | 'notifications' | 'preferences' | 'verified'>): User => {
  const newUser: User = {
    id: generateId(),
    role: 'user',
    walletBalance: 0,
    notifications: [],
    preferences: {
      darkMode: false,
    },
    verified: false,
    ...user,
  };
  const users = getUsers();
  users.push(newUser);
  localStorage.setItem('users', JSON.stringify(users));
  return newUser;
};

export const getCurrentUser = (): User => {
  const userId = localStorage.getItem('currentUserId');
  if (!userId) return null;
  return getUserById(userId);
};

export const setCurrentUser = (userId: string): void => {
  localStorage.setItem('currentUserId', userId);
};

export const logoutUser = (): void => {
  localStorage.removeItem('currentUserId');
};

export const getUserById = (id: string): User | null => {
  const users = getUsers();
  return users.find(user => user.id === id) || null;
};

export const getUserByEmail = (email: string): User | null => {
  const users = getUsers();
  return users.find(user => user.email === email) || null;
};

export const getUserByPhone = (phone: string): User | null => {
  const users = getUsers();
  return users.find(user => user.phone === phone) || null;
};

export const getUsers = (): User[] => {
  const users = localStorage.getItem('users');
  return users ? JSON.parse(users) : [];
};

export const updateUser = (userData: Partial<User>): void => {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  updateUserById(currentUser.id, userData);
};

export const updateUserById = (id: string, userData: Partial<User>): void => {
  const users = getUsers();
  const userIndex = users.findIndex(user => user.id === id);
  if (userIndex === -1) return;

  users[userIndex] = { ...users[userIndex], ...userData };
  localStorage.setItem('users', JSON.stringify(users));

  // Update current user if it's the one being updated
  if (getCurrentUser()?.id === id) {
    localStorage.setItem('currentUserId', id);
  }
};

export const pauseUser = (id: string): void => {
  updateUserById(id, { role: 'user' });
};

export const activateUser = (id: string): void => {
  // Assuming you have a way to track active status, e.g., a boolean field
  updateUserById(id, { role: 'user' });
};

export const depositToUser = (id: string, amount: number): void => {
  const user = getUserById(id);
  if (!user) return;

  const newBalance = user.walletBalance + amount;
  updateUserBalance(id, amount);

  addTransaction({
    id: generateId(),
    userId: id,
    type: 'deposit',
    amount: amount,
    status: 'completed',
    description: 'Admin deposit',
    createdAt: new Date().toISOString(),
  });
};

export const updateUserBalance = (userId: string, amount: number): void => {
  const users = getUsers();
  const userIndex = users.findIndex(user => user.id === userId);
  if (userIndex === -1) return;

  users[userIndex].walletBalance += amount;
  localStorage.setItem('users', JSON.stringify(users));
};

export const verifyUserWithOTP = (userId: string): void => {
  updateUserById(userId, { verified: true, otp: undefined });
};

// Contribution functions
export const createContribution = (contribution: Omit<Contribution, 'id' | 'createdAt' | 'currentAmount' | 'members' | 'contributors' | 'accountNumber'>): Contribution => {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('No current user');

  const newContribution: Contribution = {
    id: generateId(),
    currentAmount: 0,
    createdAt: new Date().toISOString(),
    members: [currentUser.id],
    contributors: [],
    accountNumber: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
    ...contribution,
    creatorId: currentUser.id,
  };
  const contributions = getContributions();
  contributions.push(newContribution);
  localStorage.setItem('contributions', JSON.stringify(contributions));
  return newContribution;
};

export const getContributions = (): Contribution[] => {
  const contributions = localStorage.getItem('contributions');
  return contributions ? JSON.parse(contributions) : [];
};

export const getContributionById = (id: string): Contribution | null => {
  const contributions = getContributions();
  return contributions.find(contribution => contribution.id === id) || null;
};

export const getUserContributions = (userId: string): Contribution[] => {
  const contributions = getContributions();
  return contributions.filter(contribution => contribution.members.includes(userId));
};

export const getContributionByAccountNumber = (accountNumber: string): Contribution | null => {
  const contributions = getContributions();
  return contributions.find(contribution => contribution.accountNumber === accountNumber) || null;
};

export const contributeToGroup = (contributionId: string, amount: number, anonymous: boolean = false): void => {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('No current user');

  const contribution = getContributionById(contributionId);
  if (!contribution) throw new Error('Contribution not found');

  if (currentUser.walletBalance < amount) {
    throw new Error('Insufficient funds in your wallet');
  }

  // Update contribution
  contribution.currentAmount += amount;
  contribution.contributors.push({ userId: currentUser.id, amount, anonymous });

  // Update user balance
  updateUserBalance(currentUser.id, -amount);

  // Add transaction
  addTransaction({
    id: generateId(),
    userId: currentUser.id,
    type: 'deposit',
    amount: amount,
    status: 'completed',
    description: `Contribution to ${contribution.name}`,
    createdAt: new Date().toISOString(),
    contributionId: contributionId,
    contributionName: contribution.name,
  });

  // Save changes
  const contributions = getContributions();
  const contributionIndex = contributions.findIndex(c => c.id === contributionId);
  if (contributionIndex > -1) {
    contributions[contributionIndex] = contribution;
    localStorage.setItem('contributions', JSON.stringify(contributions));
  }
};

export const contributeByAccountNumber = (accountNumber: string, amount: number, contributorInfo: { name: string, email?: string, phone?: string }, anonymous: boolean = false): void => {
  const contribution = getContributionByAccountNumber(accountNumber);
  if (!contribution) {
    throw new Error('Contribution group not found with this account number.');
  }

  // Create a temporary user if the contributor is not registered
  let tempUserId = generateId();
  let tempUser = {
    id: tempUserId,
    name: contributorInfo.name,
    email: contributorInfo.email || '',
    phone: contributorInfo.phone || '',
    role: 'user',
    walletBalance: 0,
    pin: '',
    accountNumber: '',
    bvn: '',
    notifications: [],
    preferences: { darkMode: false },
    verified: false,
  };

  // Update contribution
  contribution.currentAmount += amount;
  contribution.contributors.push({ userId: tempUserId, amount, anonymous });

  // Add transaction
  addTransaction({
    id: generateId(),
    userId: tempUserId,
    type: 'deposit',
    amount: amount,
    status: 'completed',
    description: `Contribution to ${contribution.name} via account number`,
    createdAt: new Date().toISOString(),
    contributionId: contribution.id,
    contributionName: contribution.name,
    senderName: contributorInfo.name,
  });

  // Save changes
  const contributions = getContributions();
  const contributionIndex = contributions.findIndex(c => c.id === contribution.id);
  if (contributionIndex > -1) {
    contributions[contributionIndex] = contribution;
    localStorage.setItem('contributions', JSON.stringify(contributions));
  }
};

// Withdrawal Request functions
export const createWithdrawalRequest = (request: Omit<WithdrawalRequest, 'id' | 'createdAt' | 'status' | 'votes' | 'deadline'>): WithdrawalRequest => {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('No current user');

  const contribution = getContributionById(request.contributionId);
    if (!contribution) {
        throw new Error('Contribution not found');
    }

    if (contribution.creatorId !== currentUser.id) {
        throw new Error('Only the group creator can request withdrawals');
    }

    if (contribution.currentAmount < request.amount) {
        throw new Error('Requested amount exceeds available funds');
    }

  const newWithdrawalRequest: WithdrawalRequest = {
    id: generateId(),
    status: 'pending',
    votes: [],
    createdAt: new Date().toISOString(),
    deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
    ...request,
  };
  const withdrawalRequests = getWithdrawalRequests();
  withdrawalRequests.push(newWithdrawalRequest);
  localStorage.setItem('withdrawalRequests', JSON.stringify(withdrawalRequests));
  return newWithdrawalRequest;
};

export const getWithdrawalRequests = (): WithdrawalRequest[] => {
  const withdrawalRequests = localStorage.getItem('withdrawalRequests');
  return withdrawalRequests ? JSON.parse(withdrawalRequests) : [];
};

export const getWithdrawalRequestById = (id: string): WithdrawalRequest | null => {
  const withdrawalRequests = getWithdrawalRequests();
  return withdrawalRequests.find(request => request.id === id) || null;
};

export const voteOnWithdrawalRequest = (requestId: string, vote: 'approve' | 'reject'): void => {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('No current user');

  const withdrawalRequest = getWithdrawalRequestById(requestId);
  if (!withdrawalRequest) throw new Error('Withdrawal request not found');

  const contribution = getContributionById(withdrawalRequest.contributionId);
    if (!contribution) {
        throw new Error('Contribution not found');
    }

    if (!contribution.members.includes(currentUser.id)) {
        throw new Error('You are not a member of this contribution group and cannot vote.');
    }

  // Check if user has already voted
  const existingVote = withdrawalRequest.votes.find(v => v.userId === currentUser.id);
  if (existingVote) {
    throw new Error('You have already voted on this request');
  }

  withdrawalRequest.votes.push({ userId: currentUser.id, vote });

  // Update withdrawal request
  const withdrawalRequests = getWithdrawalRequests();
  const requestIndex = withdrawalRequests.findIndex(request => request.id === requestId);
  if (requestIndex > -1) {
    withdrawalRequests[requestIndex] = withdrawalRequest;
    localStorage.setItem('withdrawalRequests', JSON.stringify(withdrawalRequests));
  }

  // Check if request is approved or rejected
  const approveVotes = withdrawalRequest.votes.filter(v => v.vote === 'approve').length;
  const rejectVotes = withdrawalRequest.votes.filter(v => v.vote === 'reject').length;
  const totalMembers = contribution.members.length;

  if (approveVotes > totalMembers / 2) {
    // Approve withdrawal
    withdrawalRequest.status = 'approved';
    processWithdrawal(withdrawalRequest);
  } else if (rejectVotes > totalMembers / 2) {
    // Reject withdrawal
    withdrawalRequest.status = 'rejected';
  }

  // Save changes
  localStorage.setItem('withdrawalRequests', JSON.stringify(withdrawalRequests));
};

export const updateWithdrawalRequestsStatus = (): void => {
  const withdrawalRequests = getWithdrawalRequests();
  const updatedRequests = withdrawalRequests.map(request => {
    if (request.status === 'pending' && new Date(request.deadline) < new Date()) {
      // If deadline is past, mark as rejected
      request.status = 'rejected';
    }
    return request;
  });
  localStorage.setItem('withdrawalRequests', JSON.stringify(updatedRequests));
};

// Transaction functions
export const addTransaction = (transaction: Omit<Transaction, 'id'>): Transaction => {
  const newTransaction: Transaction = {
    id: generateId(),
    ...transaction,
  };
  const transactions = getTransactions();
  transactions.push(newTransaction);
  localStorage.setItem('transactions', JSON.stringify(transactions));
  return newTransaction;
};

export const getTransactions = (): Transaction[] => {
  const transactions = localStorage.getItem('transactions');
  return transactions ? JSON.parse(transactions) : [];
};

// Notification functions
export const addNotification = (notification: Omit<Notification, 'id' | 'createdAt'>): Notification => {
  const newNotification: Notification = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    ...notification,
  };
  const user = getUserById(newNotification.userId);
  if (!user) return newNotification;

  user.notifications.push(newNotification);
  updateUserById(user.id, { notifications: user.notifications });
  return newNotification;
};

export const getNotifications = (userId: string): Notification[] => {
  const user = getUserById(userId);
  return user ? user.notifications : [];
};

export const markNotificationAsRead = (notificationId: string): void => {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  const notification = currentUser.notifications.find(n => n.id === notificationId);
  if (!notification) return;

  notification.read = true;
  updateUserById(currentUser.id, { notifications: currentUser.notifications });
};

// Add the missing markAllNotificationsAsRead function
export const markAllNotificationsAsRead = (): void => {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  const updatedNotifications = currentUser.notifications.map(notification => ({
    ...notification,
    read: true
  }));
  
  updateUserById(currentUser.id, { notifications: updatedNotifications });
};

// Stats functions
export const getStatistics = (): Stats => {
  const users = getUsers();
  const contributions = getContributions();
  const transactions = getTransactions();

  const totalAmountContributed = contributions.reduce((sum, contribution) => sum + contribution.currentAmount, 0);
  const totalWithdrawals = transactions.filter(transaction => transaction.type === 'withdrawal').reduce((sum, transaction) => sum + transaction.amount, 0);

  return {
    totalUsers: users.length,
    totalContributions: contributions.length,
    totalAmountContributed,
    totalWithdrawals,
  };
};

// Share Link function
export const generateShareLink = (contributionId: string): string => {
  return `${window.location.origin}/contribute/share/${contributionId}`;
};

// Utility functions
const processWithdrawal = (request: WithdrawalRequest): void => {
  const contribution = getContributionById(request.contributionId);
  const currentUser = getCurrentUser();

  if (!contribution) throw new Error('Contribution not found');
  if (!currentUser) throw new Error('No current user');

  if (contribution.currentAmount < request.amount) {
    throw new Error('Insufficient funds in the contribution');
  }

  // Deduct amount from contribution
  contribution.currentAmount -= request.amount;

  // Add transaction
  addTransaction({
    id: generateId(),
    userId: currentUser.id,
    type: 'withdrawal',
    amount: request.amount,
    status: 'completed',
    description: `Withdrawal from ${contribution.name}`,
    createdAt: new Date().toISOString(),
    contributionId: request.contributionId,
    contributionName: contribution.name,
  });

  // Update contribution
  const contributions = getContributions();
  const contributionIndex = contributions.findIndex(c => c.id === request.contributionId);
  if (contributionIndex > -1) {
    contributions[contributionIndex] = contribution;
    localStorage.setItem('contributions', JSON.stringify(contributions));
  }
};

// Ping Group Members for Vote
export const pingGroupMembersForVote = (requestId: string): void => {
  const withdrawalRequest = getWithdrawalRequestById(requestId);
  if (!withdrawalRequest) throw new Error('Withdrawal request not found');

  const contribution = getContributionById(withdrawalRequest.contributionId);
  if (!contribution) throw new Error('Contribution not found');

  // Get user IDs of members who haven't voted
  const nonVoters = contribution.members.filter(memberId =>
    !withdrawalRequest.votes.some(vote => vote.userId === memberId)
  );

  // Send notifications to non-voters
  nonVoters.forEach(userId => {
    addNotification({
      userId: userId,
      message: `Please vote on the withdrawal request for ${contribution.name}`,
      type: 'info',
      read: false,
      relatedId: requestId,
    });
  });
};

// Generate Contribution Receipt
export const generateContributionReceipt = (transactionId: string): any => {
  const transaction = getTransactions().find(t => t.id === transactionId);
  if (!transaction) return null;

  const user = getUserById(transaction.userId);
  if (!user) return null;

  return {
    transactionId: transaction.id,
    userId: user.id,
    userName: user.name,
    transactionType: transaction.type,
    amount: transaction.amount,
    status: transaction.status,
    description: transaction.description,
    createdAt: transaction.createdAt,
  };
};

// Get a list of Nigerian banks (simplified list for demo)
export const getBankList = (): { code: string; name: string }[] => {
  // Check if we already have banks in localStorage
  const storedBanks = localStorage.getItem('bankList');
  if (storedBanks) {
    return JSON.parse(storedBanks);
  }
  
  // Default list of banks
  const banks = [
    { code: "044", name: "Access Bank" },
    { code: "023", name: "Citibank Nigeria" },
    { code: "063", name: "Diamond Bank" },
    { code: "050", name: "Ecobank Nigeria" },
    { code: "084", name: "Enterprise Bank" },
    { code: "070", name: "Fidelity Bank" },
    { code: "011", name: "First Bank of Nigeria" },
    { code: "214", name: "First City Monument Bank" },
    { code: "058", name: "Guaranty Trust Bank" },
    { code: "030", name: "Heritage Bank" },
    { code: "301", name: "Jaiz Bank" },
    { code: "082", name: "Keystone Bank" },
    { code: "014", name: "MainStreet Bank" },
    { code: "076", name: "Polaris Bank" },
    { code: "039", name: "Stanbic IBTC Bank" },
    { code: "232", name: "Sterling Bank" },
    { code: "032", name: "Union Bank of Nigeria" },
    { code: "033", name: "United Bank For Africa" },
    { code: "215", name: "Unity Bank" },
    { code: "035", name: "Wema Bank" },
    { code: "057", name: "Zenith Bank" },
    { code: "100", name: "SunTrust Bank" },
    { code: "102", name: "Providus Bank" },
    { code: "103", name: "Globus Bank" },
    { code: "101", name: "Titan Trust Bank" },
    { code: "120", name: "Kuda Bank" },
    { code: "110", name: "PayCom (OPay)" },
    { code: "565", name: "Moniepoint Microfinance Bank" },
    { code: "100004", name: "Paga" },
    { code: "100002", name: "PalmPay" }
  ];
  
  // Store in localStorage for future use
  localStorage.setItem('bankList', JSON.stringify(banks));
  
  return banks;
};

// Initialize local storage with default data
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
  
  // Initialize bank list
  getBankList();
};

// Add the hasContributed function
export const hasContributed = (userId: string, contributionId: string): boolean => {
  try {
    const contribution = getContributionById(contributionId);
    if (!contribution) return false;
    
    return contribution.contributors.some(contributor => contributor.userId === userId);
  } catch (error) {
    console.error("Error in hasContributed:", error);
    return false;
  }
};
