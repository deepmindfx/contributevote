
import { User, Contribution, Transaction, WithdrawalRequest, Notification, Stats } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { isValid } from 'date-fns';
import { toast } from 'sonner';

// Initialize localStorage with default data if empty
export const initializeLocalStorage = (): void => {
  if (!localStorage.getItem('users')) {
    localStorage.setItem('users', JSON.stringify([]));
  }
  if (!localStorage.getItem('contributions')) {
    localStorage.setItem('contributions', JSON.stringify([]));
  }
  if (!localStorage.getItem('transactions')) {
    localStorage.setItem('transactions', JSON.stringify([]));
  }
  if (!localStorage.getItem('withdrawalRequests')) {
    localStorage.setItem('withdrawalRequests', JSON.stringify([]));
  }
};

// User related functions
export const getUsers = (): User[] => {
  try {
    const users = localStorage.getItem('users');
    return users ? JSON.parse(users) : [];
  } catch (error) {
    console.error("Error getting users:", error);
    return [];
  }
};

export const getCurrentUser = (): User | null => {
  try {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
};

export const updateUser = (userData: Partial<User>): void => {
  try {
    const currentUser = getCurrentUser();
    if (currentUser && userData) {
      const updatedUser = { ...currentUser, ...userData };
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      
      // Also update the user in the users array
      const users = getUsers();
      const updatedUsers = users.map(user => 
        user.id === currentUser.id ? { ...user, ...userData } : user
      );
      localStorage.setItem('users', JSON.stringify(updatedUsers));
    }
  } catch (error) {
    console.error("Error updating user:", error);
  }
};

export const updateUserById = (userId: string, userData: Partial<User>): void => {
  try {
    const users = getUsers();
    const userIndex = users.findIndex(user => user.id === userId);
    
    if (userIndex >= 0) {
      users[userIndex] = { ...users[userIndex], ...userData };
      localStorage.setItem('users', JSON.stringify(users));
      
      // If this is the current user, update that too
      const currentUser = getCurrentUser();
      if (currentUser && currentUser.id === userId) {
        localStorage.setItem('currentUser', JSON.stringify({
          ...currentUser,
          ...userData
        }));
      }
    }
  } catch (error) {
    console.error("Error updating user by ID:", error);
  }
};

export const pauseUser = (userId: string): void => {
  updateUserById(userId, { status: 'paused' });
};

export const activateUser = (userId: string): void => {
  updateUserById(userId, { status: 'active' });
};

export const depositToUser = (userId: string, amount: number): void => {
  try {
    const users = getUsers();
    const userIndex = users.findIndex(user => user.id === userId);
    
    if (userIndex >= 0) {
      const currentBalance = users[userIndex].walletBalance || 0;
      users[userIndex].walletBalance = currentBalance + amount;
      localStorage.setItem('users', JSON.stringify(users));
      
      // If this is the current user, update that too
      const currentUser = getCurrentUser();
      if (currentUser && currentUser.id === userId) {
        currentUser.walletBalance = (currentUser.walletBalance || 0) + amount;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
      }
      
      // Add transaction record
      addTransaction({
        id: uuidv4(),
        userId,
        type: 'deposit',
        amount,
        description: 'Admin deposit',
        status: 'completed',
        createdAt: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error("Error depositing to user:", error);
  }
};

export const logoutUser = (): void => {
  localStorage.removeItem('currentUser');
};

export const getUserByEmail = (email: string): User | null => {
  try {
    const users = getUsers();
    return users.find(user => user.email === email) || null;
  } catch (error) {
    console.error("Error getting user by email:", error);
    return null;
  }
};

export const getUserByPhone = (phone: string): User | null => {
  try {
    const users = getUsers();
    return users.find(user => user.phone === phone) || null;
  } catch (error) {
    console.error("Error getting user by phone:", error);
    return null;
  }
};

export const addNotification = (notification: Omit<Notification, 'id' | 'createdAt'>): void => {
  try {
    const users = getUsers();
    const userIndex = users.findIndex(user => user.id === notification.userId);
    
    if (userIndex >= 0) {
      const notifications = users[userIndex].notifications || [];
      const newNotification = {
        ...notification,
        id: uuidv4(),
        createdAt: new Date().toISOString()
      };
      
      users[userIndex].notifications = [newNotification, ...notifications];
      localStorage.setItem('users', JSON.stringify(users));
      
      // If this is the current user, update that too
      const currentUser = getCurrentUser();
      if (currentUser && currentUser.id === notification.userId) {
        currentUser.notifications = [newNotification, ...(currentUser.notifications || [])];
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
      }
    }
  } catch (error) {
    console.error("Error adding notification:", error);
  }
};

export const markNotificationAsRead = (notificationId: string): void => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.notifications) return;
    
    const updatedNotifications = currentUser.notifications.map(notification => 
      notification.id === notificationId 
        ? { ...notification, read: true } 
        : notification
    );
    
    // Update current user
    currentUser.notifications = updatedNotifications;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // Update in users array
    const users = getUsers();
    const userIndex = users.findIndex(user => user.id === currentUser.id);
    if (userIndex >= 0) {
      users[userIndex].notifications = updatedNotifications;
      localStorage.setItem('users', JSON.stringify(users));
    }
  } catch (error) {
    console.error("Error marking notification as read:", error);
  }
};

export const markAllNotificationsAsRead = (): void => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.notifications) return;
    
    const updatedNotifications = currentUser.notifications.map(notification => ({
      ...notification,
      read: true
    }));
    
    // Update current user
    currentUser.notifications = updatedNotifications;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // Update in users array
    const users = getUsers();
    const userIndex = users.findIndex(user => user.id === currentUser.id);
    if (userIndex >= 0) {
      users[userIndex].notifications = updatedNotifications;
      localStorage.setItem('users', JSON.stringify(users));
    }
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
  }
};

// Contribution related functions
export const getContributions = (): Contribution[] => {
  try {
    const contributions = localStorage.getItem('contributions');
    return contributions ? JSON.parse(contributions) : [];
  } catch (error) {
    console.error("Error getting contributions:", error);
    return [];
  }
};

export const getUserContributions = (userId: string): Contribution[] => {
  try {
    const allContributions = getContributions();
    return allContributions.filter(contribution => 
      contribution.creatorId === userId || contribution.members.includes(userId)
    );
  } catch (error) {
    console.error("Error getting user contributions:", error);
    return [];
  }
};

export const getContributionByAccountNumber = (accountNumber: string): Contribution | null => {
  try {
    const allContributions = getContributions();
    return allContributions.find(contribution => contribution.accountNumber === accountNumber) || null;
  } catch (error) {
    console.error("Error getting contribution by account number:", error);
    return null;
  }
};

export const createContribution = (contribution: Omit<Contribution, 'id' | 'createdAt' | 'currentAmount' | 'members' | 'contributors'>): Contribution => {
  try {
    const newContribution: Contribution = {
      ...contribution,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      currentAmount: 0,
      status: 'active',
      members: [contribution.creatorId], // Creator is automatically a member
      contributors: [],
    };
    
    const contributions = getContributions();
    contributions.push(newContribution);
    localStorage.setItem('contributions', JSON.stringify(contributions));
    
    return newContribution;
  } catch (error) {
    console.error("Error creating contribution:", error);
    throw error;
  }
};

export const contributeToGroup = (contributionId: string, amount: number, anonymous: boolean = false): void => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      throw new Error("User not authenticated");
    }
    
    // Verify user has sufficient balance
    if (currentUser.walletBalance < amount) {
      throw new Error("Insufficient wallet balance");
    }
    
    const contributions = getContributions();
    const contributionIndex = contributions.findIndex(c => c.id === contributionId);
    
    if (contributionIndex === -1) {
      throw new Error("Contribution not found");
    }
    
    // Update contribution amount
    contributions[contributionIndex].currentAmount += amount;
    
    // Add user to members if not already there
    if (!contributions[contributionIndex].members.includes(currentUser.id)) {
      contributions[contributionIndex].members.push(currentUser.id);
    }
    
    // Add to contributors
    contributions[contributionIndex].contributors.push({
      userId: currentUser.id,
      name: anonymous ? "Anonymous" : currentUser.name || `${currentUser.firstName} ${currentUser.lastName}`,
      amount,
      date: new Date().toISOString(),
      anonymous
    });
    
    // Save updated contribution
    localStorage.setItem('contributions', JSON.stringify(contributions));
    
    // Deduct from user's wallet
    updateUserBalance(currentUser.id, -amount);
    
    // Add transaction record
    const transactionId = uuidv4();
    addTransaction({
      id: transactionId,
      userId: currentUser.id,
      type: 'transfer',
      amount,
      contributionId,
      description: `Contribution to ${contributions[contributionIndex].name}`,
      status: 'completed',
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error contributing to group:", error);
    throw error;
  }
};

export const contributeByAccountNumber = (accountNumber: string, amount: number, contributorInfo: { name: string; email?: string; phone?: string }, anonymous: boolean = false): void => {
  try {
    const contributions = getContributions();
    const contribution = contributions.find(c => c.accountNumber === accountNumber);
    
    if (!contribution) {
      throw new Error("Invalid account number");
    }
    
    // Update contribution amount
    const contributionIndex = contributions.findIndex(c => c.id === contribution.id);
    contributions[contributionIndex].currentAmount += amount;
    
    // Add contributor info
    contributions[contributionIndex].contributors.push({
      userId: 'external',  // External contributor doesn't have a user ID
      name: anonymous ? "Anonymous" : contributorInfo.name,
      amount,
      date: new Date().toISOString(),
      anonymous
    });
    
    // Save updated contribution
    localStorage.setItem('contributions', JSON.stringify(contributions));
    
    // Add transaction record
    addTransaction({
      id: uuidv4(),
      userId: 'external',
      type: 'transfer',
      amount,
      contributionId: contribution.id,
      description: `External contribution to ${contribution.name}`,
      status: 'completed',
      createdAt: new Date().toISOString(),
      metaData: {
        contributorName: contributorInfo.name,
        contributorEmail: contributorInfo.email,
        contributorPhone: contributorInfo.phone
      }
    });
  } catch (error) {
    console.error("Error contributing by account number:", error);
    throw error;
  }
};

export const generateShareLink = (contributionId: string): string => {
  // In a real app, this might be a more complex logic or involve a URL shortener
  return `${window.location.origin}/contribute/share/${contributionId}`;
};

// Withdrawal request functions
export const getWithdrawalRequests = (): WithdrawalRequest[] => {
  try {
    const requests = localStorage.getItem('withdrawalRequests');
    return requests ? JSON.parse(requests) : [];
  } catch (error) {
    console.error("Error getting withdrawal requests:", error);
    return [];
  }
};

export const createWithdrawalRequest = (request: Omit<WithdrawalRequest, 'id' | 'createdAt' | 'status' | 'votes' | 'deadline'>): WithdrawalRequest => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      throw new Error("User not authenticated");
    }
    
    // Set deadline to 48 hours from now
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + 48);
    
    const newRequest: WithdrawalRequest = {
      ...request,
      id: uuidv4(),
      requesterId: currentUser.id,
      status: 'pending',
      createdAt: new Date().toISOString(),
      deadline: deadline.toISOString(),
      votes: []
    };
    
    const requests = getWithdrawalRequests();
    requests.push(newRequest);
    localStorage.setItem('withdrawalRequests', JSON.stringify(requests));
    
    // Notify group members
    pingGroupMembersForVote(newRequest.id);
    
    return newRequest;
  } catch (error) {
    console.error("Error creating withdrawal request:", error);
    throw error;
  }
};

export const voteOnWithdrawalRequest = (requestId: string, vote: 'approve' | 'reject'): void => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      throw new Error("User not authenticated");
    }
    
    const requests = getWithdrawalRequests();
    const requestIndex = requests.findIndex(r => r.id === requestId);
    
    if (requestIndex === -1) {
      throw new Error("Withdrawal request not found");
    }
    
    const request = requests[requestIndex];
    
    // Check if request is still pending
    if (request.status !== 'pending') {
      throw new Error(`This request has already been ${request.status}`);
    }
    
    // Check if deadline has passed
    if (new Date(request.deadline) < new Date()) {
      throw new Error("Voting deadline has passed");
    }
    
    // Check if user is a member of the contribution group
    const contribution = getContributions().find(c => c.id === request.contributionId);
    if (!contribution || !contribution.members.includes(currentUser.id)) {
      throw new Error("You are not a member of this contribution group");
    }
    
    // Check if user has already voted
    if (request.votes.some(v => v.userId === currentUser.id)) {
      throw new Error("You have already voted on this request");
    }
    
    // Add user's vote
    request.votes.push({
      userId: currentUser.id,
      vote,
      date: new Date().toISOString()
    });
    
    // Check if majority has been reached
    const totalMembers = contribution.members.length;
    const requiredVotes = Math.ceil(totalMembers / 2);  // Simple majority
    
    const approveVotes = request.votes.filter(v => v.vote === 'approve').length;
    const rejectVotes = request.votes.filter(v => v.vote === 'reject').length;
    
    // Update status if majority reached
    if (approveVotes >= requiredVotes) {
      request.status = 'approved';
      
      // Transfer funds to the requester
      const requester = getUsers().find(u => u.id === request.requesterId);
      if (requester) {
        updateUserBalance(requester.id, request.amount);
        
        // Deduct from contribution amount
        const contributions = getContributions();
        const contribIndex = contributions.findIndex(c => c.id === request.contributionId);
        if (contribIndex >= 0) {
          contributions[contribIndex].currentAmount -= request.amount;
          localStorage.setItem('contributions', JSON.stringify(contributions));
        }
        
        // Add transaction record
        addTransaction({
          id: uuidv4(),
          userId: requester.id,
          type: 'withdrawal',
          amount: request.amount,
          contributionId: request.contributionId,
          description: `Withdrawal from ${contribution.name}: ${request.purpose}`,
          status: 'completed',
          createdAt: new Date().toISOString()
        });
      }
    } else if (rejectVotes >= requiredVotes) {
      request.status = 'rejected';
    }
    
    // Update the request
    requests[requestIndex] = request;
    localStorage.setItem('withdrawalRequests', JSON.stringify(requests));
    
    // Add transaction record for the vote
    addTransaction({
      id: uuidv4(),
      userId: currentUser.id,
      type: 'vote',
      amount: 0,
      contributionId: request.contributionId,
      description: `Voted to ${vote} withdrawal request: ${request.purpose}`,
      status: 'completed',
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error voting on withdrawal request:", error);
    throw error;
  }
};

export const updateWithdrawalRequestsStatus = (): void => {
  try {
    const requests = getWithdrawalRequests();
    let updated = false;
    
    const updatedRequests = requests.map(request => {
      if (request.status === 'pending' && new Date(request.deadline) < new Date()) {
        updated = true;
        return { ...request, status: 'expired' };
      }
      return request;
    });
    
    if (updated) {
      localStorage.setItem('withdrawalRequests', JSON.stringify(updatedRequests));
    }
  } catch (error) {
    console.error("Error updating withdrawal requests status:", error);
  }
};

export const pingGroupMembersForVote = (requestId: string): void => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const requests = getWithdrawalRequests();
    const request = requests.find(r => r.id === requestId);
    
    if (!request) return;
    
    const contribution = getContributions().find(c => c.id === request.contributionId);
    if (!contribution) return;
    
    // Send notification to all members who haven't voted yet
    const users = getUsers();
    
    contribution.members.forEach(memberId => {
      // Skip if member is the requester or has already voted
      if (
        memberId === request.requesterId ||
        request.votes.some(v => v.userId === memberId)
      ) {
        return;
      }
      
      // Add notification for the member
      addNotification({
        userId: memberId,
        message: `Reminder: Your vote is needed for the withdrawal request in "${contribution.name}"`,
        type: 'info',
        read: false,
        relatedId: request.contributionId
      });
    });
  } catch (error) {
    console.error("Error pinging group members for vote:", error);
  }
};

// Transaction functions
export const getTransactions = (): Transaction[] => {
  try {
    const transactions = localStorage.getItem('transactions');
    return transactions ? JSON.parse(transactions) : [];
  } catch (error) {
    console.error("Error getting transactions:", error);
    return [];
  }
};

export const addTransaction = (transaction: Transaction): void => {
  try {
    const transactions = getTransactions();
    transactions.push(transaction);
    localStorage.setItem('transactions', JSON.stringify(transactions));
  } catch (error) {
    console.error("Error adding transaction:", error);
  }
};

export const updateUserBalance = (userId: string, amount: number): void => {
  try {
    const users = getUsers();
    const userIndex = users.findIndex(user => user.id === userId);
    
    if (userIndex >= 0) {
      const currentBalance = users[userIndex].walletBalance || 0;
      users[userIndex].walletBalance = currentBalance + amount;
      localStorage.setItem('users', JSON.stringify(users));
      
      // If this is the current user, update that too
      const currentUser = getCurrentUser();
      if (currentUser && currentUser.id === userId) {
        currentUser.walletBalance = (currentUser.walletBalance || 0) + amount;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
      }
    }
  } catch (error) {
    console.error("Error updating user balance:", error);
  }
};

// Receipt generation
export const generateContributionReceipt = (transactionId: string): any => {
  try {
    const transactions = getTransactions();
    const transaction = transactions.find(t => t.id === transactionId);
    
    if (!transaction) return null;
    
    // Get additional data based on transaction type
    const user = getUsers().find(u => u.id === transaction.userId);
    let contribution = null;
    
    if (transaction.contributionId) {
      contribution = getContributions().find(c => c.id === transaction.contributionId);
    }
    
    // Create receipt object
    const receipt = {
      receiptNumber: `RCP-${transaction.id.substring(0, 8)}`,
      transactionId: transaction.id,
      date: transaction.createdAt,
      amount: transaction.amount,
      description: transaction.description,
      payerName: user ? user.name || `${user.firstName} ${user.lastName}` : "External Contributor",
      payerEmail: user ? user.email : (transaction.metaData?.contributorEmail || "N/A"),
      payeeInfo: contribution ? {
        name: contribution.name,
        description: contribution.description,
        accountNumber: contribution.accountNumber,
        bankName: contribution.bankName
      } : null,
      status: transaction.status,
      type: transaction.type
    };
    
    return receipt;
  } catch (error) {
    console.error("Error generating receipt:", error);
    return null;
  }
};

// Statistics functions
export const getStatistics = (): Stats => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return {
        totalContributions: 0,
        activeContributions: 0,
        totalContributed: 0,
        totalMembers: 0
      };
    }
    
    const contributions = getUserContributions(currentUser.id);
    const transactions = getTransactions().filter(
      t => t.userId === currentUser.id && t.type === 'transfer'
    );
    
    // Calculate statistics
    const totalContributions = contributions.length;
    const activeContributions = contributions.filter(c => c.status === 'active').length;
    const totalContributed = transactions.reduce((sum, t) => sum + t.amount, 0);
    
    // Calculate unique members across all contributions
    const uniqueMembers = new Set();
    contributions.forEach(c => {
      c.members.forEach(m => uniqueMembers.add(m));
    });
    const totalMembers = uniqueMembers.size;
    
    return {
      totalContributions,
      activeContributions,
      totalContributed,
      totalMembers
    };
  } catch (error) {
    console.error("Error calculating statistics:", error);
    return {
      totalContributions: 0,
      activeContributions: 0,
      totalContributed: 0,
      totalMembers: 0
    };
  }
};

// User management functions for admin
export const createUser = (userData: any): void => {
  try {
    const users = getUsers();
    users.push(userData);
    localStorage.setItem('users', JSON.stringify(users));
  } catch (error) {
    console.error("Error creating user:", error);
  }
};

export const deleteUser = (userId: string): void => {
  try {
    const users = getUsers();
    const updatedUsers = users.filter((user: any) => user.id !== userId);
    localStorage.setItem('users', JSON.stringify(updatedUsers));
  } catch (error) {
    console.error("Error deleting user:", error);
  }
};

export const updateUserRole = (userId: string, role: string): void => {
  try {
    const users = getUsers();
    const userIndex = users.findIndex((user: any) => user.id === userId);
    
    if (userIndex >= 0) {
      users[userIndex].role = role;
      localStorage.setItem('users', JSON.stringify(users));
      
      // If this is the current user, update that too
      const currentUser = getCurrentUser();
      if (currentUser && currentUser.id === userId) {
        currentUser.role = role;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
      }
    }
  } catch (error) {
    console.error("Error updating user role:", error);
  }
};

// OTP verification
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
