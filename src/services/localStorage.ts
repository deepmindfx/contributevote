
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

// Contribution related functions
export const getContributions = (): Contribution[] => {
  const contributionsString = localStorage.getItem('contributions');
  if (!contributionsString) {
    return [];
  }
  return JSON.parse(contributionsString);
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

// Notification related functions
export const getNotifications = (): Notification[] => {
  const notificationsString = localStorage.getItem('notifications');
  if (!notificationsString) {
    return [];
  }
  return JSON.parse(notificationsString);
};

export const addNotification = (notification: Notification): void => {
  const notifications = getNotifications();
  notifications.push(notification);
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

export const clearAllNotifications = (userId: string): void => {
  const notifications = getNotifications();
  const otherNotifications = notifications.filter(n => n.userId !== userId);
  localStorage.setItem('notifications', JSON.stringify(otherNotifications));
};

// Stats related functions
export const getStats = (): Stats => {
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
