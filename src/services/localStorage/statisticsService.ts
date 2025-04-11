
import { AppStats, localStorageKeys } from "./types";

/**
 * Function to get app statistics
 */
export const getStatistics = (): AppStats => {
  const statsString = localStorage.getItem(localStorageKeys.appStats);
  if (!statsString) {
    return {
      totalUsers: 0,
      totalContributions: 0,
      totalTransactions: 0,
      totalAmount: 0,
      activeRequests: 0,
      totalWithdrawals: 0,
      totalAmountContributed: 0
    };
  }
  return JSON.parse(statsString);
};

/**
 * Function to update app statistics
 */
export const updateAppStats = (updatedStats: Partial<AppStats>): void => {
  const currentStats = getStatistics();
  const newStats = { ...currentStats, ...updatedStats };
  localStorage.setItem(localStorageKeys.appStats, JSON.stringify(newStats));
};
