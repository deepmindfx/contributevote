
// Re-export all types
export * from './types';

// Re-export user functions
export {
  getUsers,
  getUserById,
  getCurrentUser,
  updateUser,
  updateUserById,
  addUser,
  updateUserBalance,
  depositToUser,
  activateUser,
  pauseUser,
  verifyUserWithOTP,
  getUserByEmail,
  getUserByPhone,
  logoutUser,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  addNotification
} from './userService';

// Re-export contribution functions
export {
  getContributions,
  getUserContributions,
  getContributionById,
  createContribution,
  updateContribution,
  getContributionByAccountNumber,
  generateShareLink,
  isGroupCreator
} from './contributionService';

// Re-export transaction functions
export {
  getTransactions,
  getAllTransactions,
  getTransactionById,
  addTransaction,
  contributeToGroup,
  hasContributed,
  generateContributionReceipt,
  contributeByAccountNumber
} from './transactionService';

// Re-export withdrawal functions
export {
  getWithdrawalRequests,
  createWithdrawalRequest,
  voteOnWithdrawalRequest,
  updateWithdrawalRequestsStatus,
  pingGroupMembersForVote
} from './withdrawalService';

// Re-export statistics functions
export {
  getStatistics,
  updateAppStats
} from './statisticsService';

/**
 * Function to initialize local storage with default values
 */
export const initializeLocalStorage = (): void => {
  // Initialize any required localStorage items
  // This would be implemented in a real application
};
