
import { v4 as uuidv4 } from 'uuid';
import { User, Contribution, Transaction, WithdrawalRequest, Notification, Stats } from './types';

export const initializeLocalStorage = () => {
  // Check if localStorage has been initialized
  if (!localStorage.getItem('initialized')) {
    // Initialize empty arrays for all collections if they don't exist
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
    
    if (!localStorage.getItem('notifications')) {
      localStorage.setItem('notifications', JSON.stringify([]));
    }
    
    if (!localStorage.getItem('statistics')) {
      localStorage.setItem('statistics', JSON.stringify({
        totalUsers: 0,
        activeGroups: 0,
        totalContributed: 0
      }));
    }
    
    localStorage.setItem('initialized', 'true');
  }
};

// Helper to ensure clean account data on signup
export const ensureCleanAccountForNewUser = (userId: string) => {
  try {
    // Clear any existing association of this user with contributions
    const contributionsStr = localStorage.getItem('contributions');
    if (contributionsStr) {
      const contributions = JSON.parse(contributionsStr);
      
      // Filter out any contributions created by this user
      const filteredContributions = contributions.filter(
        (c: Contribution) => c.creatorId !== userId
      );
      
      // Remove this user from any contribution members
      const updatedContributions = filteredContributions.map((c: Contribution) => ({
        ...c,
        members: c.members.filter((m: string) => m !== userId),
        contributors: c.contributors.filter((contributor: any) => contributor.userId !== userId)
      }));
      
      localStorage.setItem('contributions', JSON.stringify(updatedContributions));
    }
    
    // Clear any transactions for this user
    const transactionsStr = localStorage.getItem('transactions');
    if (transactionsStr) {
      const transactions = JSON.parse(transactionsStr);
      const filteredTransactions = transactions.filter(
        (t: Transaction) => t.userId !== userId
      );
      localStorage.setItem('transactions', JSON.stringify(filteredTransactions));
    }
    
    // Clear any withdrawal requests for this user
    const withdrawalRequestsStr = localStorage.getItem('withdrawalRequests');
    if (withdrawalRequestsStr) {
      const withdrawalRequests = JSON.parse(withdrawalRequestsStr);
      const filteredWithdrawals = withdrawalRequests.filter(
        (w: WithdrawalRequest) => w.userId !== userId
      );
      localStorage.setItem('withdrawalRequests', JSON.stringify(filteredWithdrawals));
    }
    
    // Clear any notifications for this user
    const notificationsStr = localStorage.getItem('notifications');
    if (notificationsStr) {
      const notifications = JSON.parse(notificationsStr);
      const filteredNotifications = notifications.filter(
        (n: Notification) => n.userId !== userId
      );
      localStorage.setItem('notifications', JSON.stringify(filteredNotifications));
    }
    
    console.log(`Ensured clean account for new user ${userId}`);
  } catch (error) {
    console.error("Failed to ensure clean account for new user:", error);
  }
};

export const generateDummyData = () => {
  // Only generate data if user specifically requests it
  console.log('This function has been disabled to ensure new users start with clean accounts.');
};
