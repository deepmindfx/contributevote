
import { getBaseUsers, getBaseContributions } from './storageUtils';
import { getTransactions } from './transactionOperations';
import { Stats } from './types';

export const getStatistics = (): Stats => {
  try {
    const users = getBaseUsers();
    const contributions = getBaseContributions();
    const transactions = getTransactions();

    const totalAmount = transactions
      .filter(t => t.type === 'contribution' && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);

    const activeGroups = contributions.filter(c => c.status === 'active').length;
    const completedGroups = contributions.filter(c => c.status === 'completed').length;

    return {
      totalContributions: contributions.length,
      totalAmount,
      activeGroups,
      completedGroups,
      totalUsers: users.length
    };
  } catch (error) {
    console.error("Error getting statistics:", error);
    return {
      totalContributions: 0,
      totalAmount: 0,
      activeGroups: 0,
      completedGroups: 0,
      totalUsers: 0
    };
  }
};
