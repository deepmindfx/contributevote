
// Import from types first to avoid circular dependencies
import { User, Transaction, Contribution, WithdrawalRequest, Notification, Stats } from './localStorage/types';

// Import from the base localStorage.ts without creating circular references
import {
  ensureAccountNumberDisplay, verifyUserWithOTP, validateDate, 
  getContributionByAccountNumber, reExportEnsureAccountNumberDisplay,
  addTransaction
} from '@/localStorage';

// Import from storage utilities
import { 
  getBaseUsers, getBaseContributions, getBaseCurrentUser, 
  getBaseContributionById 
} from './localStorage/storageUtils';

// Import from modules
import { initializeLocalStorage, generateDummyData } from './localStorage/initialization';
import { 
  createUser, setCurrentUser, logoutUser, 
  updateUser, updateUserById, pauseUser, activateUser, depositToUser,
  getUserByEmail, getUserByPhone, getUsers
} from './localStorage/userOperations';
import {
  getUserContributions, getContributionById, 
  createContribution, updateContribution, contributeToGroup,
  contributeByAccountNumber, generateShareLink, getContributions
} from './localStorage/contributionOperations';
import {
  getWithdrawalRequests, createWithdrawalRequest, updateWithdrawalRequest, 
  voteOnWithdrawalRequest, pingGroupMembersForVote, updateWithdrawalRequestsStatus
} from './localStorage/withdrawalOperations';
import {
  getTransactions, createTransaction
} from './localStorage/transactionOperations';
import {
  getNotifications, addNotification, markNotificationAsRead, markAllNotificationsAsRead
} from './localStorage/notificationOperations';
import { getStatistics } from './localStorage/statisticsOperations';
import { generateContributionReceipt } from './localStorage/receiptOperations';
import { 
  updateUserBalance, hasContributed 
} from './localStorage/utilityOperations';

// Re-export the direct localStorage functions
export const getCurrentUser = getBaseCurrentUser;

// Re-export everything for backward compatibility
export {
  initializeLocalStorage, generateDummyData,
  createUser, setCurrentUser, logoutUser,
  updateUser, updateUserById, pauseUser, activateUser, depositToUser,
  getUserContributions, getContributionById, getContributions, getUsers,
  createContribution, updateContribution, contributeToGroup,
  contributeByAccountNumber, getWithdrawalRequests, createWithdrawalRequest,
  updateWithdrawalRequest, voteOnWithdrawalRequest, updateUserBalance,
  getTransactions, createTransaction, hasContributed,
  getNotifications, addNotification, markNotificationAsRead, markAllNotificationsAsRead,
  getStatistics, generateShareLink, getUserByEmail, getUserByPhone,
  pingGroupMembersForVote, generateContributionReceipt,
  updateWithdrawalRequestsStatus,
  // Re-exported from original localStorage.ts
  ensureAccountNumberDisplay, verifyUserWithOTP, validateDate,
  getContributionByAccountNumber, reExportEnsureAccountNumberDisplay,
  addTransaction
};

// Re-export the interfaces
export type { User, Transaction, Contribution, WithdrawalRequest, Notification, Stats };
