
// Import from types first to avoid circular dependencies
import { User, Transaction, Contribution, WithdrawalRequest, Notification, Stats } from './localStorage/types';

// Import from the base localStorage.ts without creating circular references
import {
  ensureAccountNumberDisplay, verifyUserWithOTP, validateDate, 
  getContributionByAccountNumber, reExportEnsureAccountNumberDisplay,
  addTransaction, getCurrentUser as getBaseCurrentUser, getUsers as getBaseUsers,
  getContributions as getBaseContributions
} from '@/localStorage';

// Import from modules
import { initializeLocalStorage, generateDummyData } from './localStorage/initialization';
import { 
  createUser, setCurrentUser, logoutUser, 
  updateUser, updateUserById, pauseUser, activateUser, depositToUser,
  getUserByEmail, getUserByPhone
} from './localStorage/userOperations';
import {
  getUserContributions, getContributionById, 
  createContribution, updateContribution, contributeToGroup,
  contributeByAccountNumber, generateShareLink
} from './localStorage/contributionOperations';
import {
  getWithdrawalRequests, createWithdrawalRequest, updateWithdrawalRequest, 
  voteOnWithdrawalRequest, pingGroupMembersForVote, updateWithdrawalRequestsStatus
} from './localStorage/withdrawalOperations';
import {
  getTransactions, createTransaction
} from './localStorage/transactionOperations';
import {
  getNotifications, addNotification, markNotificationAsRead, markAllNotificationsAsRead as markAllNotifications
} from './localStorage/notificationOperations';
import { getStatistics } from './localStorage/statisticsOperations';
import { generateContributionReceipt } from './localStorage/receiptOperations';
import { 
  updateUserBalance, hasContributed 
} from './localStorage/utilityOperations';

// Re-export the direct localStorage functions
export const getCurrentUser = getBaseCurrentUser;
export const getUsers = getBaseUsers;
export const getContributions = getBaseContributions;

// Re-export everything for backward compatibility
export {
  initializeLocalStorage, generateDummyData,
  createUser, setCurrentUser, logoutUser,
  updateUser, updateUserById, pauseUser, activateUser, depositToUser,
  getUserContributions, getContributionById,
  createContribution, updateContribution, contributeToGroup,
  contributeByAccountNumber, getWithdrawalRequests, createWithdrawalRequest,
  updateWithdrawalRequest, voteOnWithdrawalRequest, updateUserBalance,
  getTransactions, createTransaction, hasContributed,
  getNotifications, addNotification, markNotificationAsRead,
  getStatistics, generateShareLink, getUserByEmail, getUserByPhone,
  pingGroupMembersForVote, generateContributionReceipt,
  updateWithdrawalRequestsStatus, markAllNotifications,
  // Re-exported from original localStorage.ts
  ensureAccountNumberDisplay, verifyUserWithOTP, validateDate,
  getContributionByAccountNumber, reExportEnsureAccountNumberDisplay,
  addTransaction
};

// Re-export the interfaces
export type { User, Transaction, Contribution, WithdrawalRequest, Notification, Stats };
