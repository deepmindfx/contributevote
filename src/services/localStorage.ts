let initialized = false;

export interface User {
  id: string;
  firstName: string;
  lastName?: string;
  name: string;
  email: string;
  phone?: string; // Changed from phoneNumber to phone
  profileImage?: string;
  walletBalance: number;
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt?: string;
  preferences?: {
    darkMode: boolean;
    anonymousContributions: boolean;
    notificationsEnabled?: boolean;
  };
  notifications?: Notification[];
  status: 'active' | 'paused';
  pin?: string;
  verified: boolean;
}

export interface Contribution {
  id: string;
  creatorId: string;
  name: string;
  description: string;
  category: 'education' | 'health' | 'business' | 'personal';
  targetAmount: number;
  currentAmount: number;
  startDate: string;
  endDate?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  members: string[]; // User IDs
  contributors: {
    userId: string;
    name: string;
    amount: number;
    date: string;
    anonymous: boolean;
  }[];
  createdAt: string;
  accountNumber: string;
  votingThreshold: number;
  bannerImage?: string;
}

export interface WithdrawalRequest {
  id: string;
  contributionId: string;
  requesterId: string;
  amount: number;
  purpose: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
  votes: {
    userId: string;
    vote: 'approve' | 'reject';
  }[];
  deadline: string;
}

export interface Transaction {
  id: string;
  userId: string;
  contributionId: string;
  type: 'deposit' | 'withdrawal' | 'contribution';
  amount: number;
  description: string;
  createdAt: string;
  status?: 'pending' | 'completed' | 'failed';
  anonymous?: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt?: string;
  relatedId?: string;
}

export interface Stats {
  totalUsers: number;
  totalContributions: number;
  totalWithdrawals: number;
  totalAmountContributed: number;
}

const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

const generateAccountNumber = (): string => {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
};

export const initializeLocalStorage = (): void => {
  if (initialized) return;
  initialized = true;

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

  if (!localStorage.getItem('stats')) {
    localStorage.setItem('stats', JSON.stringify({
      totalUsers: 0,
      totalContributions: 0,
      totalWithdrawals: 0,
      totalAmountContributed: 0
    }));
  }
};

export const registerUser = (user: Omit<User, 'id' | 'walletBalance' | 'role' | 'createdAt' | 'updatedAt' | 'preferences' | 'notifications' | 'status' | 'verified'>): User => {
  const users = getUsers();
  const existingUser = users.find(u => u.email === user.email || u.phone === user.phone);

  if (existingUser) {
    throw new Error('Email or phone number already registered');
  }

  const newUser: User = {
    id: generateId(),
    ...user,
    walletBalance: 0,
    role: 'user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    preferences: {
      darkMode: false,
      anonymousContributions: false,
      notificationsEnabled: true
    },
    notifications: [],
    status: 'active',
    verified: false,
  };

  users.push(newUser);
  localStorage.setItem('users', JSON.stringify(users));
  updateStatistics();
  return newUser;
};

export const verifyUserWithOTP = (userId: string): void => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === userId);
  
  if (index >= 0) {
    users[index].verified = true;
    localStorage.setItem('users', JSON.stringify(users));
    
    // If this is the current user, update that too
    const currentUser = getCurrentUser();
    if (currentUser.id === userId) {
      currentUser.verified = true;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    }
    
    // Add notification
    addNotification({
      userId,
      message: "Your account has been successfully verified!",
      type: 'success',
      read: false,
      relatedId: '',
    });
  }
};

export const loginUser = (email: string): User => {
  const users = getUsers();
  const user = users.find(u => u.email === email);

  if (!user) {
    throw new Error('Invalid credentials');
  }

  localStorage.setItem('currentUser', JSON.stringify(user));
  return user;
};

export const logoutUser = (): void => {
  localStorage.removeItem('currentUser');
};

export const getCurrentUser = (): User => {
  const user = localStorage.getItem('currentUser');
  return user ? JSON.parse(user) : null;
};

export const updateUser = (userData: Partial<Omit<User, 'id' | 'role' | 'createdAt' | 'walletBalance' | 'status' | 'verified'>>): void => {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    throw new Error('No user logged in');
  }

  const users = getUsers();
  const index = users.findIndex(u => u.id === currentUser.id);

  if (index === -1) {
    throw new Error('User not found');
  }

  const updatedUser = {
    ...currentUser,
    ...userData,
    updatedAt: new Date().toISOString()
  };

  users[index] = updatedUser;
  localStorage.setItem('users', JSON.stringify(users));
  localStorage.setItem('currentUser', JSON.stringify(updatedUser));
};

export const updateUserById = (userId: string, userData: Partial<Omit<User, 'id' | 'role' | 'createdAt' | 'walletBalance' | 'status' | 'verified'>>): void => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === userId);

  if (index === -1) {
    throw new Error('User not found');
  }

  const updatedUser = {
    ...users[index],
    ...userData,
    updatedAt: new Date().toISOString()
  };

  users[index] = updatedUser;
  localStorage.setItem('users', JSON.stringify(users));
};

export const getUsers = (): User[] => {
  const users = localStorage.getItem('users');
  return users ? JSON.parse(users) : [];
};

export const getUserByEmail = (email: string): User | null => {
  const users = getUsers();
  return users.find(user => user.email === email) || null;
};

export const getUserByPhone = (phone: string): User | null => {
  const users = getUsers();
  return users.find(user => user.phone === phone) || null;
};

export const createContribution = (contribution: Omit<Contribution, 'id' | 'createdAt' | 'currentAmount' | 'members' | 'contributors' | 'accountNumber'>): Contribution => {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    throw new Error('No user logged in');
  }

  if (!contribution.votingThreshold) {
    contribution.votingThreshold = 51;
  }

  const newContribution: Contribution = {
    id: generateId(),
    creatorId: currentUser.id,
    ...contribution,
    currentAmount: 0,
    members: [currentUser.id],
    contributors: [],
    createdAt: new Date().toISOString(),
    accountNumber: generateAccountNumber(),
  };

  const contributions = getContributions();
  contributions.push(newContribution);
  localStorage.setItem('contributions', JSON.stringify(contributions));
  updateStatistics();
  return newContribution;
};

export const getContributions = (): Contribution[] => {
  const contributions = localStorage.getItem('contributions');
  return contributions ? JSON.parse(contributions) : [];
};

export const getContributionByAccountNumber = (accountNumber: string): Contribution | null => {
  const contributions = getContributions();
  return contributions.find(c => c.accountNumber === accountNumber) || null;
};

export const getUserContributions = (userId: string): Contribution[] => {
  const contributions = getContributions();
  return contributions.filter(c => c.members.includes(userId));
};

export const contributeToGroup = (contributionId: string, amount: number, anonymous: boolean = false): void => {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    throw new Error('No user logged in');
  }

  if (currentUser.walletBalance < amount) {
    throw new Error('Insufficient funds in your wallet');
  }

  const contributions = getContributions();
  const index = contributions.findIndex(c => c.id === contributionId);

  if (index === -1) {
    throw new Error('Contribution group not found');
  }

  contributions[index].currentAmount += amount;

  // Add contributor
  const existingContributor = contributions[index].contributors.find(c => c.userId === currentUser.id);
  if (existingContributor) {
    existingContributor.amount += amount;
    existingContributor.date = new Date().toISOString();
    existingContributor.anonymous = anonymous;
  } else {
    contributions[index].contributors.push({
      userId: currentUser.id,
      name: `${currentUser.firstName} ${currentUser.lastName || ''}`,
      amount,
      date: new Date().toISOString(),
      anonymous
    });
  }

  // Add member if not already a member
  if (!contributions[index].members.includes(currentUser.id)) {
    contributions[index].members.push(currentUser.id);
  }

  localStorage.setItem('contributions', JSON.stringify(contributions));

  // Record transaction
  recordTransaction({
    userId: currentUser.id,
    contributionId: contributionId,
    type: 'contribution',
    amount,
    description: `Contribution to ${contributions[index].name}`,
    anonymous
  });

  // Update user balance
  updateUserBalance(-amount);
  updateStatistics();
};

export const contributeByAccountNumber = (accountNumber: string, amount: number, contributorInfo: { name: string, email?: string, phone?: string }, anonymous: boolean = false): void => {
  const contributions = getContributions();
  const contribution = contributions.find(c => c.accountNumber === accountNumber);

  if (!contribution) {
    throw new Error('Contribution group not found');
  }

  contribution.currentAmount += amount;

  // Add contributor
  contribution.contributors.push({
    userId: generateId(), // Since it's an external contribution, generate a temporary ID
    name: contributorInfo.name,
    amount,
    date: new Date().toISOString(),
    anonymous
  });

  localStorage.setItem('contributions', JSON.stringify(contributions));

  // Record transaction
  recordTransaction({
    userId: 'external', // Mark as external contribution
    contributionId: contribution.id,
    type: 'deposit',
    amount,
    description: `Contribution to ${contribution.name} from ${contributorInfo.name}`,
    anonymous
  });
  updateStatistics();
};

export const hasContributed = (userId: string, contributionId: string): boolean => {
  const contributions = getContributions();
  const contribution = contributions.find(c => c.id === contributionId);
  return !!contribution?.contributors.some(c => c.userId === userId);
};

export const createWithdrawalRequest = (request: Omit<WithdrawalRequest, 'id' | 'createdAt' | 'status' | 'votes' | 'deadline'>): void => {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    throw new Error('No user logged in');
  }

  const contributions = getContributions();
  const contribution = contributions.find(c => c.id === request.contributionId);

  if (!contribution) {
    throw new Error('Contribution group not found');
  }

  if (contribution.creatorId !== currentUser.id) {
    throw new Error('Only the group creator can request withdrawals');
  }

  const newWithdrawalRequest: WithdrawalRequest = {
    id: generateId(),
    ...request,
    requesterId: currentUser.id,
    createdAt: new Date().toISOString(),
    status: 'pending',
    votes: [],
    deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
  };

  const withdrawalRequests = getWithdrawalRequests();
  withdrawalRequests.push(newWithdrawalRequest);
  localStorage.setItem('withdrawalRequests', JSON.stringify(withdrawalRequests));
};

export const getWithdrawalRequests = (): WithdrawalRequest[] => {
  const withdrawalRequests = localStorage.getItem('withdrawalRequests');
  return withdrawalRequests ? JSON.parse(withdrawalRequests) : [];
};

export const voteOnWithdrawalRequest = (requestId: string, voteValue: 'approve' | 'reject'): void => {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    throw new Error('No user logged in');
  }

  const withdrawalRequests = getWithdrawalRequests();
  const requestIndex = withdrawalRequests.findIndex(r => r.id === requestId);

  if (requestIndex === -1) {
    throw new Error('Withdrawal request not found');
  }

  const request = withdrawalRequests[requestIndex];
  const contributions = getContributions();
  const contribution = contributions.find(c => c.id === request.contributionId);

  if (!contribution) {
    throw new Error('Contribution group not found');
  }

  if (!contribution.members.includes(currentUser.id)) {
    throw new Error('You are not a member of this contribution group');
  }

  if (!hasContributed(currentUser.id, contribution.id)) {
    throw new Error('You must contribute to this group before voting');
  }

  const existingVote = request.votes.find(v => v.userId === currentUser.id);

  if (existingVote) {
    throw new Error('You have already voted on this request');
  }

  withdrawalRequests[requestIndex].votes.push({
    userId: currentUser.id,
    vote: voteValue
  });

  localStorage.setItem('withdrawalRequests', JSON.stringify(withdrawalRequests));
};

export const updateWithdrawalRequestsStatus = (): void => {
  const withdrawalRequests = getWithdrawalRequests();
  const contributions = getContributions();
  const updatedRequests = withdrawalRequests.map(request => {
    if (request.status === 'pending') {
      const deadline = new Date(request.deadline);
      const now = new Date();

      if (deadline < now) {
        // Deadline has passed
        const contribution = contributions.find(c => c.id === request.contributionId);
        if (!contribution) {
          // Contribution not found, mark as rejected
          request.status = 'rejected';
        } else {
          const totalContributors = contribution.members.filter(m => hasContributed(m, contribution.id)).length;
          const totalVotes = request.votes.length;

          if (totalContributors > 0 && totalVotes >= (totalContributors / 2)) {
            // At least 50% of contributors voted, calculate result
            const approveVotes = request.votes.filter(v => v.vote === 'approve').length;
            const rejectVotes = request.votes.filter(v => v.vote === 'reject').length;
            const totalVotesCast = approveVotes + rejectVotes;

            if (totalVotesCast > 0) {
              const approvePercentage = (approveVotes / totalVotesCast) * 100;

              if (approvePercentage >= contribution.votingThreshold) {
                // Approved
                request.status = 'approved';
                completeWithdrawal(request.contributionId, request.id, request.amount);
              } else {
                // Rejected
                request.status = 'rejected';
              }
            } else {
              // No votes cast, mark as rejected
              request.status = 'rejected';
            }
          } else {
            // Less than 50% of contributors voted, extend deadline by 24 hours
            request.deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          }
        }
      }
    }
    return request;
  });

  localStorage.setItem('withdrawalRequests', JSON.stringify(updatedRequests));
};

const completeWithdrawal = (contributionId: string, requestId: string, amount: number): void => {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    throw new Error('No user logged in');
  }

  const contributions = getContributions();
  const index = contributions.findIndex(c => c.id === contributionId);

  if (index === -1) {
    throw new Error('Contribution group not found');
  }

  if (contributions[index].currentAmount < amount) {
    throw new Error('Insufficient funds in the contribution group');
  }

  contributions[index].currentAmount -= amount;
  localStorage.setItem('contributions', JSON.stringify(contributions));

  // Record transaction
  recordTransaction({
    userId: currentUser.id,
    contributionId: contributionId,
    type: 'withdrawal',
    amount,
    description: `Withdrawal from ${contributions[index].name}`
  });
  updateStatistics();
};

const recordTransaction = (transaction: Omit<Transaction, 'id' | 'createdAt'>): void => {
  const transactions = getTransactions();
  const newTransaction: Transaction = {
    id: generateId(),
    ...transaction,
    createdAt: new Date().toISOString()
  };
  transactions.push(newTransaction);
  localStorage.setItem('transactions', JSON.stringify(transactions));
};

export const getTransactions = (): Transaction[] => {
  const transactions = localStorage.getItem('transactions');
  return transactions ? JSON.parse(transactions) : [];
};

export const updateUserBalance = (amount: number): void => {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    throw new Error('No user logged in');
  }

  const users = getUsers();
  const index = users.findIndex(u => u.id === currentUser.id);

  if (index === -1) {
    throw new Error('User not found');
  }

  users[index].walletBalance += amount;
  localStorage.setItem('users', JSON.stringify(users));

  const updatedUser = {
    ...currentUser,
    walletBalance: currentUser.walletBalance + amount
  };

  localStorage.setItem('currentUser', JSON.stringify(updatedUser));

  // Record transaction
  recordTransaction({
    userId: currentUser.id,
    contributionId: '',
    type: 'deposit',
    amount,
    description: `Wallet deposit`
  });
  updateStatistics();
};

const updateStatistics = (): void => {
  const users = getUsers();
  const contributions = getContributions();
  const transactions = getTransactions();
  const withdrawals = transactions.filter(t => t.type === 'withdrawal');
  const totalAmountContributed = contributions.reduce((acc, c) => acc + c.currentAmount, 0);

  const stats: Stats = {
    totalUsers: users.length,
    totalContributions: contributions.length,
    totalWithdrawals: withdrawals.length,
    totalAmountContributed: totalAmountContributed
  };

  localStorage.setItem('stats', JSON.stringify(stats));
};

export const getStatistics = (): Stats => {
  const stats = localStorage.getItem('stats');
  return stats ? JSON.parse(stats) : null;
};

export const generateShareLink = (contributionId: string): string => {
  return `${window.location.origin}/contribute/share/${contributionId}`;
};

export const pauseUser = (userId: string): void => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === userId);

  if (index === -1) {
    throw new Error('User not found');
  }

  users[index].status = 'paused';
  localStorage.setItem('users', JSON.stringify(users));
};

export const activateUser = (userId: string): void => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === userId);

  if (index === -1) {
    throw new Error('User not found');
  }

  users[index].status = 'active';
  localStorage.setItem('users', JSON.stringify(users));
};

export const depositToUser = (userId: string, amount: number): void => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === userId);

  if (index === -1) {
    throw new Error('User not found');
  }

  users[index].walletBalance += amount;
  localStorage.setItem('users', JSON.stringify(users));
};

export const addNotification = (notification: Omit<Notification, 'id' | 'createdAt'>): void => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === notification.userId);

  if (index === -1) {
    throw new Error('User not found');
  }

  const newNotification: Notification = {
    id: generateId(),
    ...notification,
    createdAt: new Date().toISOString()
  };

  users[index].notifications = [...(users[index].notifications || []), newNotification];
  localStorage.setItem('users', JSON.stringify(users));
};

export const markNotificationAsRead = (notificationId: string): void => {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    throw new Error('No user logged in');
  }

  const users = getUsers();
  const index = users.findIndex(u => u.id === currentUser.id);

  if (index === -1) {
    throw new Error('User not found');
  }

  const notificationIndex = users[index].notifications?.findIndex(n => n.id === notificationId);

  if (notificationIndex === undefined || notificationIndex === -1) {
    throw new Error('Notification not found');
  }

  users[index].notifications[notificationIndex] = {
    ...users[index].notifications[notificationIndex],
    read: true
  };

  localStorage.setItem('users', JSON.stringify(users));
  localStorage.setItem('currentUser', JSON.stringify(users[index]));
};

export const markAllNotificationsAsRead = (): void => {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    throw new Error('No user logged in');
  }

  const users = getUsers();
  const index = users.findIndex(u => u.id === currentUser.id);

  if (index === -1) {
    throw new Error('User not found');
  }

  users[index].notifications = users[index].notifications?.map(n => ({
    ...n,
    read: true
  })) || [];

  localStorage.setItem('users', JSON.stringify(users));
  localStorage.setItem('currentUser', JSON.stringify(users[index]));
};

export const pingGroupMembersForVote = (requestId: string): void => {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    throw new Error('No user logged in');
  }

  const withdrawalRequests = getWithdrawalRequests();
  const requestIndex = withdrawalRequests.findIndex(r => r.id === requestId);

  if (requestIndex === -1) {
    throw new Error('Withdrawal request not found');
  }

  const request = withdrawalRequests[requestIndex];
  const contributions = getContributions();
  const contribution = contributions.find(c => c.id === request.contributionId);

  if (!contribution) {
    throw new Error('Contribution group not found');
  }

  const nonVotingMembers = contribution.members.filter(memberId => {
    const hasVoted = request.votes.some(vote => vote.userId === memberId);
    return !hasVoted;
  });

  nonVotingMembers.forEach(memberId => {
    if (memberId !== currentUser.id) {
      const member = getUsers().find(u => u.id === memberId);
      if (member) {
        addNotification({
          userId: memberId,
          message: `${currentUser.name} is reminding you to vote on the withdrawal request for "${contribution.name}"`,
          type: 'info',
          read: false,
          relatedId: request.contributionId
        });
      }
    }
  });
};

export const generateContributionReceipt = (transactionId: string): any => {
  const transaction = getTransactions().find(t => t.id === transactionId);
  if (!transaction || transaction.type !== 'deposit') {
    console.error('Transaction not found or not a deposit');
    return null;
  }

  const contribution = getContributions().find(c => c.id === transaction.contributionId);
  if (!contribution) {
    console.error('Contribution not found');
    return null;
  }

  const user = getUsers().find(u => u.id === transaction.userId);
  if (!user) {
    console.error('User not found');
    return null;
  }

  return {
    receiptNumber: generateId(),
    date: transaction.createdAt,
    contributionName: contribution.name,
    accountNumber: contribution.accountNumber,
    contributorName: user.name,
    amount: transaction.amount
  };
};

// Make sure validateDate function exists
import { isValid } from "date-fns";

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
