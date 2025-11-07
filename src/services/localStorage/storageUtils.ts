
import { User, Contribution, Transaction } from './types';

// Direct storage access functions that don't depend on other modules
export const getBaseUsers = (): User[] => {
  try {
    const usersString = localStorage.getItem('users');
    return usersString ? JSON.parse(usersString) : [];
  } catch (error) {
    console.error("Error getting users:", error);
    return [];
  }
};

export const getBaseContributions = (): Contribution[] => {
  try {
    const contributionsString = localStorage.getItem('contributions');
    return contributionsString ? JSON.parse(contributionsString) : [];
  } catch (error) {
    console.error("Error getting contributions:", error);
    return [];
  }
};

export const getBaseCurrentUser = (): User | null => {
  try {
    const userString = localStorage.getItem('currentUser');
    return userString ? JSON.parse(userString) : null;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
};

export const getBaseContributionById = (id: string): Contribution | undefined => {
  const contributions = getBaseContributions();
  return contributions.find(contribution => contribution.id === id);
};

export const getBaseTransactions = (): Transaction[] => {
  try {
    const transactionsString = localStorage.getItem('transactions');
    return transactionsString ? JSON.parse(transactionsString) : [];
  } catch (error) {
    console.error("Error getting transactions:", error);
    return [];
  }
};
