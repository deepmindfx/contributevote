
import { Stats } from './types';
import { getUsers } from './userOperations';
import { getContributions } from './contributionOperations';
import { getWithdrawalRequests } from './withdrawalOperations';
import { getTransactions } from './transactionOperations';

export const getStatistics = (): Stats => {
  const users = getUsers();
  const contributions = getContributions();
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
