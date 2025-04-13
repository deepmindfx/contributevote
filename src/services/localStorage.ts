
// Re-export from modules for backward compatibility
import { initializeLocalStorage, generateDummyData } from './localStorage/initialization';
import { 
  getCurrentUser, getUsers, createUser, setCurrentUser, logoutUser, 
  updateUser, updateUserById, pauseUser, activateUser, depositToUser,
  getUserByEmail, getUserByPhone
} from './localStorage/userOperations';
import {
  getContributions, getUserContributions, getContributionById, 
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
  getNotifications, addNotification, markNotificationAsRead, markAllNotificationsAsRead
} from './localStorage/notificationOperations';
import { getStatistics } from './localStorage/statisticsOperations';
import { generateContributionReceipt } from './localStorage/receiptOperations';
import { 
  updateUserBalance, hasContributed 
} from './localStorage/utilityOperations';

// Re-export from original localStorage.ts
import {
  ensureAccountNumberDisplay, verifyUserWithOTP, validateDate, 
  getContributionByAccountNumber, reExportEnsureAccountNumberDisplay,
  addTransaction, User, Transaction, Contribution
} from '@/localStorage';

// Re-export everything for backward compatibility
export {
  initializeLocalStorage, generateDummyData,
  getCurrentUser, getUsers, createUser, setCurrentUser, logoutUser,
  updateUser, updateUserById, pauseUser, activateUser, depositToUser,
  getContributions, getUserContributions, getContributionById,
  createContribution, updateContribution, contributeToGroup,
  contributeByAccountNumber, getWithdrawalRequests, createWithdrawalRequest,
  updateWithdrawalRequest, voteOnWithdrawalRequest, updateUserBalance,
  getTransactions, createTransaction, hasContributed,
  getNotifications, addNotification, markNotificationAsRead,
  getStatistics, generateShareLink, getUserByEmail, getUserByPhone,
  pingGroupMembersForVote, generateContributionReceipt,
  updateWithdrawalRequestsStatus, markAllNotificationsAsRead,
  // Re-exported from original localStorage.ts
  ensureAccountNumberDisplay, verifyUserWithOTP, validateDate,
  getContributionByAccountNumber, reExportEnsureAccountNumberDisplay,
  addTransaction
};

// Re-export the interfaces
export type { User, Transaction, Contribution };
export type { WithdrawalRequest, Notification, Stats } from './localStorage/types';
