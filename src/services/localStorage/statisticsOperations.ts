
import { Stats } from './types';
import { getBaseUsers } from './storageUtils';
import { getBaseContributions } from './storageUtils';
import { getWithdrawalRequests } from './withdrawalOperations';
import { getTransactions } from './transactionOperations';

export const getStatistics = (): Stats => {
  const users = getBaseUsers();
  const contributions = getBaseContributions();
  const withdrawalRequests = getWithdrawalRequests();
  const transactions = getTransactions();

  const totalAmountContributed = transactions
    .filter(transaction => transaction.type === 'deposit')
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  return {
    totalUsers: users.length,
    totalContributions: contributions.length,
    totalWithdrawals: withdrawalRequests.length,
    totalAmountContributed,
  };
};
