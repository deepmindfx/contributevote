import { User, Contribution, WithdrawalRequest, Transaction, Stats, Notification } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Initialize local storage with demo data
export const initializeLocalStorage = () => {
  // Initial setup code
  if (!localStorage.getItem('initialized')) {
    // Create demo data
    console.log('Initializing local storage with demo data');
    localStorage.setItem('initialized', 'true');
    
    // Add your initialization code here
  }
};

// User related functions
export const getUsers = (): User[] => {
  try {
    const users = localStorage.getItem('users');
    return users ? JSON.parse(users) : [];
  } catch (error) {
    console.error('Error getting users:', error);
    return [];
  }
};

export const getCurrentUser = (): User => {
  try {
    const currentUser = localStorage.getItem('currentUser');
    return currentUser ? JSON.parse(currentUser) : null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return {} as User;
  }
};

export const updateUser = (userData: Partial<User>): void => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) return;
    
    // Update current user
    const updatedUser = {
      ...currentUser,
      ...userData,
    };
    
    localStorage.setItem('currentUser', JSON.stringify(updatedUser));
    
    // Also update in users array
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === currentUser.id);
    
    if (userIndex !== -1) {
      users[userIndex] = updatedUser;
      localStorage.setItem('users', JSON.stringify(users));
    }
  } catch (error) {
    console.error('Error updating user:', error);
  }
};

export const updateUserById = (userId: string, userData: Partial<User>): void => {
  try {
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex !== -1) {
      users[userIndex] = {
        ...users[userIndex],
        ...userData,
      };
      
      localStorage.setItem('users', JSON.stringify(users));
      
      // Update current user if it's the same user
      const currentUser = getCurrentUser();
      if (currentUser && currentUser.id === userId) {
        localStorage.setItem('currentUser', JSON.stringify(users[userIndex]));
      }
    }
  } catch (error) {
    console.error('Error updating user by ID:', error);
  }
};

export const createUser = (userData: Partial<User>): User => {
  try {
    const users = getUsers();
    const newUser: User = {
      id: uuidv4(),
      email: userData.email || '',
      name: userData.name || '',
      role: userData.role || 'user',
      walletBalance: userData.walletBalance || 0,
      verified: userData.verified || false,
      status: userData.status || 'active',
      createdAt: new Date().toISOString(),
      ...userData
    };
    
    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    return newUser;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

export const deleteUser = (userId: string): void => {
  try {
    const users = getUsers();
    const updatedUsers = users.filter(user => user.id !== userId);
    localStorage.setItem('users', JSON.stringify(updatedUsers));
  } catch (error) {
    console.error('Error deleting user:', error);
  }
};

export const updateUserRole = (userId: string, role: 'user' | 'admin'): void => {
  try {
    updateUserById(userId, { role });
  } catch (error) {
    console.error('Error updating user role:', error);
  }
};

export const pauseUser = (userId: string): void => {
  try {
    updateUserById(userId, { status: 'paused' });
  } catch (error) {
    console.error('Error pausing user:', error);
  }
};

export const activateUser = (userId: string): void => {
  try {
    updateUserById(userId, { status: 'active' });
  } catch (error) {
    console.error('Error activating user:', error);
  }
};

export const depositToUser = (userId: string, amount: number): void => {
  try {
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex !== -1) {
      users[userIndex].walletBalance = (users[userIndex].walletBalance || 0) + amount;
      localStorage.setItem('users', JSON.stringify(users));
      
      // Update current user if it's the same user
      const currentUser = getCurrentUser();
      if (currentUser && currentUser.id === userId) {
        currentUser.walletBalance = users[userIndex].walletBalance;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
      }
      
      // Add transaction record
      addTransaction({
        userId,
        type: 'deposit',
        amount,
        description: 'Admin deposit',
        status: 'completed',
      });
    }
  } catch (error) {
    console.error('Error depositing to user:', error);
  }
};

export const logoutUser = (): void => {
  localStorage.removeItem('currentUser');
};

export const getUserByEmail = (email: string): User | null => {
  try {
    const users = getUsers();
    return users.find(u => u.email === email) || null;
  } catch (error) {
    console.error('Error getting user by email:', error);
    return null;
  }
};

export const getUserByPhone = (phone: string): User | null => {
  try {
    const users = getUsers();
    return users.find(u => u.phone === phone) || null;
  } catch (error) {
    console.error('Error getting user by phone:', error);
    return null;
  }
};

export const verifyUserWithOTP = (userId: string): void => {
  try {
    updateUserById(userId, { verified: true });
  } catch (error) {
    console.error('Error verifying user with OTP:', error);
  }
};

// Contribution related functions
export const getContributions = (): Contribution[] => {
  try {
    const contributions = localStorage.getItem('contributions');
    return contributions ? JSON.parse(contributions) : [];
  } catch (error) {
    console.error('Error getting contributions:', error);
    return [];
  }
};

export const getUserContributions = (userId: string): Contribution[] => {
  try {
    const allContributions = getContributions();
    return allContributions.filter(c => 
      c.creatorId === userId || c.members.includes(userId)
    );
  } catch (error) {
    console.error('Error getting user contributions:', error);
    return [];
  }
};

export const createContribution = (contributionData: any): Contribution => {
  try {
    const contributions = getContributions();
    const newContribution: Contribution = {
      id: uuidv4(),
      name: contributionData.name,
      description: contributionData.description || '',
      creatorId: contributionData.creatorId,
      goalAmount: contributionData.targetAmount || 0,
      currentAmount: 0,
      status: contributionData.status || 'active',
      startDate: contributionData.startDate || new Date().toISOString(),
      endDate: contributionData.endDate,
      frequency: contributionData.frequency,
      createdAt: new Date().toISOString(),
      members: [contributionData.creatorId], // Creator is always a member
      contributors: [],
      public: contributionData.privacy === 'public',
      // Account details
      accountNumber: contributionData.accountNumber,
      accountName: contributionData.accountName,
      bankName: contributionData.bankName,
      accountReference: contributionData.accountReference,
      accountDetails: contributionData.accountDetails,
    };
    
    contributions.push(newContribution);
    localStorage.setItem('contributions', JSON.stringify(contributions));
    
    // Add transaction for creation record
    addTransaction({
      userId: contributionData.creatorId,
      type: 'transfer',
      amount: 0,
      contributionId: newContribution.id,
      description: `Created "${newContribution.name}" group`,
      status: 'completed',
    });
    
    // Add notification to creator
    addNotification({
      userId: contributionData.creatorId,
      message: `You created "${newContribution.name}" group`,
      type: 'success',
      read: false,
    });
    
    return newContribution;
  } catch (error) {
    console.error('Error creating contribution:', error);
    throw error;
  }
};

export const contributeToGroup = (contributionId: string, amount: number, anonymous: boolean = false): void => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) throw new Error('User not found');
    
    // Check user wallet balance
    if (currentUser.walletBalance < amount) {
      throw new Error('Insufficient funds in wallet');
    }
    
    // Update user wallet balance
    updateUser({
      walletBalance: currentUser.walletBalance - amount,
    });
    
    // Update contribution
    const contributions = getContributions();
    const contributionIndex = contributions.findIndex(c => c.id === contributionId);
    
    if (contributionIndex === -1) throw new Error('Contribution not found');
    
    // Add user to members if not already a member
    if (!contributions[contributionIndex].members.includes(currentUser.id)) {
      contributions[contributionIndex].members.push(currentUser.id);
    }
    
    // Add contribution record
    contributions[contributionIndex].contributors.push({
      userId: currentUser.id,
      name: anonymous ? 'Anonymous' : currentUser.name || 'Unknown',
      amount,
      date: new Date().toISOString(),
      anonymous,
    });
    
    // Update total amount
    contributions[contributionIndex].currentAmount += amount;
    
    // Save to localStorage
    localStorage.setItem('contributions', JSON.stringify(contributions));
    
    // Add transaction record
    addTransaction({
      userId: currentUser.id,
      type: 'transfer',
      amount,
      contributionId,
      description: `Contributed to "${contributions[contributionIndex].name}"`,
      status: 'completed',
    });
    
    // Notify group creator if not the same person
    if (contributions[contributionIndex].creatorId !== currentUser.id) {
      addNotification({
        userId: contributions[contributionIndex].creatorId,
        message: `${anonymous ? 'Anonymous' : currentUser.name} contributed ₦${amount.toLocaleString()} to "${contributions[contributionIndex].name}"`,
        type: 'info',
        read: false,
        relatedId: contributionId,
      });
    }
  } catch (error) {
    console.error('Error contributing to group:', error);
    throw error;
  }
};

export const contributeByAccountNumber = (accountNumber: string, amount: number, contributorInfo: { name: string, email?: string, phone?: string }, anonymous: boolean = false): void => {
  try {
    // Find the contribution by account number
    const contributions = getContributions();
    const contribution = contributions.find(c => c.accountNumber === accountNumber);
    
    if (!contribution) throw new Error('Invalid account number');
    
    // Add contribution record
    const contributionIndex = contributions.indexOf(contribution);
    contributions[contributionIndex].contributors.push({
      userId: 'external', // External contributor
      name: anonymous ? 'Anonymous' : contributorInfo.name,
      amount,
      date: new Date().toISOString(),
      anonymous,
    });
    
    // Update total amount
    contributions[contributionIndex].currentAmount += amount;
    
    // Save to localStorage
    localStorage.setItem('contributions', JSON.stringify(contributions));
    
    // Add transaction record (attributed to the group creator for bookkeeping)
    addTransaction({
      userId: contribution.creatorId,
      type: 'deposit',
      amount,
      contributionId: contribution.id,
      description: `External contribution to "${contribution.name}" by ${anonymous ? 'Anonymous' : contributorInfo.name}`,
      status: 'completed',
      metaData: {
        contributorName: contributorInfo.name,
        contributorEmail: contributorInfo.email,
        contributorPhone: contributorInfo.phone,
        external: true,
      },
    });
    
    // Notify group creator
    addNotification({
      userId: contribution.creatorId,
      message: `${anonymous ? 'Anonymous' : contributorInfo.name} contributed ₦${amount.toLocaleString()} to "${contribution.name}" via account transfer`,
      type: 'info',
      read: false,
      relatedId: contribution.id,
    });
  } catch (error) {
    console.error('Error contributing by account number:', error);
    throw error;
  }
};

export const getContributionByAccountNumber = (accountNumber: string): Contribution | null => {
  try {
    const contributions = getContributions();
    return contributions.find(c => c.accountNumber === accountNumber) || null;
  } catch (error) {
    console.error('Error getting contribution by account number:', error);
    return null;
  }
};

// Withdrawal request related functions
export const getWithdrawalRequests = (): WithdrawalRequest[] => {
  try {
    const requests = localStorage.getItem('withdrawalRequests');
    return requests ? JSON.parse(requests) : [];
  } catch (error) {
    console.error('Error getting withdrawal requests:', error);
    return [];
  }
};

export const createWithdrawalRequest = (requestData: any): WithdrawalRequest => {
  try {
    const requests = getWithdrawalRequests();
    
    // Set deadline date (3 days from now)
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
      votes: [],
    };
    
    requests.push(newRequest);
    localStorage.setItem('withdrawalRequests', JSON.stringify(requests));
    
    // Get contribution details for notifications
    const contribution = getContributions().find(c => c.id === requestData.contributionId);
    if (contribution) {
      // Notify all group members
      contribution.members.forEach(memberId => {
        if (memberId !== requestData.requesterId) {
          addNotification({
            userId: memberId,
            message: `New withdrawal request for "${contribution.name}": ₦${requestData.amount.toLocaleString()}`,
            type: 'info',
            read: false,
            relatedId: newRequest.id,
          });
        }
      });
    }
    
    return newRequest;
  } catch (error) {
    console.error('Error creating withdrawal request:', error);
    throw error;
  }
};

export const voteOnWithdrawalRequest = (requestId: string, vote: 'approve' | 'reject'): void => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) throw new Error('User not found');
    
    const requests = getWithdrawalRequests();
    const requestIndex = requests.findIndex(r => r.id === requestId);
    
    if (requestIndex === -1) throw new Error('Withdrawal request not found');
    
    const request = requests[requestIndex];
    
    // Check if request is still pending
    if (request.status !== 'pending') {
      throw new Error(`This request has already been ${request.status}`);
    }
    
    // Check if user has already voted
    const existingVote = request.votes.findIndex(v => v.userId === currentUser.id);
    if (existingVote !== -1) {
      // Update existing vote
      request.votes[existingVote] = {
        userId: currentUser.id,
        vote,
        date: new Date().toISOString(),
      };
    } else {
      // Add new vote
      request.votes.push({
        userId: currentUser.id,
        vote,
        date: new Date().toISOString(),
      });
    }
    
    // Get contribution to check voting threshold
    const contribution = getContributions().find(c => c.id === request.contributionId);
    
    if (!contribution) throw new Error('Contribution not found');
    
    // Check if threshold is reached
    const approvalVotes = request.votes.filter(v => v.vote === 'approve').length;
    const totalMembers = contribution.members.length;
    const votingThreshold = contribution.votingThreshold || 70; // Default 70%
    
    const percentageApproved = (approvalVotes / totalMembers) * 100;
    
    // If threshold reached, approve the request
    if (percentageApproved >= votingThreshold) {
      request.status = 'approved';
      
      // Process the withdrawal
      processApprovedWithdrawal(request, contribution);
    }
    
    // Save to localStorage
    localStorage.setItem('withdrawalRequests', JSON.stringify(requests));
    
    // Record vote transaction
    addTransaction({
      userId: currentUser.id,
      type: 'vote',
      amount: 0,
      contributionId: request.contributionId,
      description: `Voted to ${vote} withdrawal request`,
      status: 'completed',
      metaData: {
        requestId,
        vote,
      },
    });
    
    // Notify requester of the vote
    if (currentUser.id !== request.requesterId) {
      addNotification({
        userId: request.requesterId,
        message: `${currentUser.name} voted to ${vote} your withdrawal request of ₦${request.amount.toLocaleString()}`,
        type: 'info',
        read: false,
        relatedId: requestId,
      });
    }
  } catch (error) {
    console.error('Error voting on withdrawal request:', error);
    throw error;
  }
};

// Helper function to process approved withdrawals
const processApprovedWithdrawal = (request: WithdrawalRequest, contribution: Contribution): void => {
  try {
    // Update contribution amount
    const contributions = getContributions();
    const contributionIndex = contributions.findIndex(c => c.id === contribution.id);
    
    if (contributionIndex !== -1) {
      contributions[contributionIndex].currentAmount -= request.amount;
      localStorage.setItem('contributions', JSON.stringify(contributions));
    }
    
    // Add transaction record
    addTransaction({
      userId: request.requesterId,
      type: 'withdrawal',
      amount: request.amount,
      contributionId: request.contributionId,
      description: `Withdrawal from "${contribution.name}" for ${request.purpose}`,
      status: 'completed',
      metaData: {
        requestId: request.id,
        approved: true,
      },
    });
    
    // Notify requester
    addNotification({
      userId: request.requesterId,
      message: `Your withdrawal request of ₦${request.amount.toLocaleString()} has been approved`,
      type: 'success',
      read: false,
      relatedId: request.id,
    });
    
    // Notify all group members
    contribution.members.forEach(memberId => {
      if (memberId !== request.requesterId) {
        addNotification({
          userId: memberId,
          message: `Withdrawal request for "${contribution.name}" (₦${request.amount.toLocaleString()}) has been approved`,
          type: 'info',
          read: false,
          relatedId: request.id,
        });
      }
    });
  } catch (error) {
    console.error('Error processing approved withdrawal:', error);
  }
};

export const updateWithdrawalRequestsStatus = (): void => {
  try {
    const requests = getWithdrawalRequests();
    const now = new Date();
    let updated = false;
    
    requests.forEach(request => {
      if (request.status === 'pending' && new Date(request.deadline) < now) {
        request.status = 'expired';
        updated = true;
        
        // Notify requester
        addNotification({
          userId: request.requesterId,
          message: `Your withdrawal request has expired due to insufficient votes`,
          type: 'warning',
          read: false,
          relatedId: request.id,
        });
      }
    });
    
    if (updated) {
      localStorage.setItem('withdrawalRequests', JSON.stringify(requests));
    }
  } catch (error) {
    console.error('Error updating withdrawal request status:', error);
  }
};

export const pingGroupMembersForVote = (requestId: string): void => {
  try {
    const requests = getWithdrawalRequests();
    const request = requests.find(r => r.id === requestId);
    
    if (!request) throw new Error('Withdrawal request not found');
    if (request.status !== 'pending') throw new Error(`This request is already ${request.status}`);
    
    const contribution = getContributions().find(c => c.id === request.contributionId);
    if (!contribution) throw new Error('Contribution not found');
    
    // Find members who haven't voted yet
    const voterIds = request.votes.map(v => v.userId);
    const nonVoters = contribution.members.filter(memberId => !voterIds.includes(memberId));
    
    // Send reminder notifications
    nonVoters.forEach(memberId => {
      addNotification({
        userId: memberId,
        message: `Reminder: Your vote is needed on a withdrawal request for "${contribution.name}"`,
        type: 'warning',
        read: false,
        relatedId: requestId,
      });
    });
  } catch (error) {
    console.error('Error pinging group members for vote:', error);
    throw error;
  }
};

// Transaction related functions
export const getTransactions = (): Transaction[] => {
  try {
    const transactions = localStorage.getItem('transactions');
    return transactions ? JSON.parse(transactions) : [];
  } catch (error) {
    console.error('Error getting transactions:', error);
    return [];
  }
};

export const addTransaction = (transactionData: any): Transaction => {
  try {
    const transactions = getTransactions();
    
    const newTransaction: Transaction = {
      id: uuidv4(),
      userId: transactionData.userId,
      type: transactionData.type,
      amount: transactionData.amount,
      contributionId: transactionData.contributionId,
      description: transactionData.description,
      status: transactionData.status || 'completed',
      createdAt: new Date().toISOString(),
      metaData: transactionData.metaData,
    };
    
    transactions.unshift(newTransaction); // Add to beginning for chronological order
    localStorage.setItem('transactions', JSON.stringify(transactions));
    
    return newTransaction;
  } catch (error) {
    console.error('Error adding transaction:', error);
    throw error;
  }
};

export const generateContributionReceipt = (transactionId: string): any => {
  try {
    const transactions = getTransactions();
    const transaction = transactions.find(t => t.id === transactionId);
    
    if (!transaction) return null;
    
    // Get contribution details if available
    let contributionName = 'Unknown';
    if (transaction.contributionId) {
      const contribution = getContributions().find(c => c.id === transaction.contributionId);
      if (contribution) {
        contributionName = contribution.name;
      }
    }
    
    // Generate receipt
    return {
      receiptNumber: `REC-${transaction.id.substring(0, 8)}`,
      transactionId: transaction.id,
      date: transaction.createdAt,
      amount: transaction.amount,
      description: transaction.description,
      contributionName,
      status: transaction.status,
      type: transaction.type,
    };
  } catch (error) {
    console.error('Error generating receipt:', error);
    return null;
  }
};

// Notification related functions
export const getNotifications = (userId: string): Notification[] => {
  try {
    const notifications = localStorage.getItem('notifications');
    const allNotifications = notifications ? JSON.parse(notifications) : [];
    return allNotifications.filter((n: Notification) => n.userId === userId);
  } catch (error) {
    console.error('Error getting notifications:', error);
    return [];
  }
};

export const addNotification = (notificationData: any): Notification => {
  try {
    const notifications = localStorage.getItem('notifications');
    const allNotifications = notifications ? JSON.parse(notifications) : [];
    
    const newNotification: Notification = {
      id: uuidv4(),
      userId: notificationData.userId,
      message: notificationData.message,
      type: notificationData.type || 'info',
      read: notificationData.read || false,
      createdAt: new Date().toISOString(),
      relatedId: notificationData.relatedId,
    };
    
    allNotifications.unshift(newNotification); // Add to beginning
    localStorage.setItem('notifications', JSON.stringify(allNotifications));
    
    return newNotification;
  } catch (error) {
    console.error('Error adding notification:', error);
    throw error;
  }
};

// Statistics related functions
export const getStatistics = (): Stats => {
  try {
    const contributions = getContributions();
    const users = getUsers();
    
    // Count active contributions
    const activeContributions = contributions.filter(c => c.status === 'active').length;
    
    // Calculate total contributed across all groups
    const totalContributed = contributions.reduce((sum, contribution) => {
      return sum + contribution.currentAmount;
    }, 0);
    
    // Count unique members across all groups
    const uniqueMembers = new Set();
    contributions.forEach(contribution => {
      contribution.members.forEach(memberId => {
        uniqueMembers.add(memberId);
      });
    });
    
    return {
      totalContributions: contributions.length,
      activeContributions,
      totalContributed,
      totalMembers: uniqueMembers.size,
    };
  } catch (error) {
    console.error('Error getting statistics:', error);
    return {
      totalContributions: 0,
      activeContributions: 0,
      totalContributed: 0,
      totalMembers: 0,
    };
  }
};

// Helper function to generate share links
export const generateShareLink = (contributionId: string): string => {
  return `${window.location.origin}/contribute/share/${contributionId}`;
};
