
import { getBaseUsers } from './storageUtils';
import { getTransactions } from './transactionOperations';
import { getBaseContributionById } from './storageUtils';

export const generateContributionReceipt = (transactionId: string) => {
  const transactions = getTransactions();
  const transaction = transactions.find(t => t.id === transactionId);
  
  if (!transaction) return null;
  
  const users = getBaseUsers();
  const user = users.find(u => u.id === transaction.userId);
  
  if (!transaction.contributionId) return null;
  
  const contribution = getBaseContributionById(transaction.contributionId);
  
  if (!contribution) return null;
  
  return {
    receiptNumber: `RCT-${transactionId.substring(0, 8).toUpperCase()}`,
    date: new Date(transaction.createdAt).toISOString(),
    amount: transaction.amount,
    payerName: user?.name || 'Anonymous',
    payerEmail: user?.email || 'N/A',
    contributionName: contribution.name,
    contributionId: contribution.id,
    transactionId: transaction.id,
    status: transaction.status || 'completed',
  };
};
