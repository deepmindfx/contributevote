
import { getTransactions } from './transactionOperations';
import { getContributionById } from './contributionOperations';
import { getUsers } from './userOperations';

export const generateContributionReceipt = (transactionId: string) => {
  const transaction = getTransactions().find(t => t.id === transactionId);
  if (!transaction) return null;
  
  const contribution = getContributionById(transaction.contributionId);
  if (!contribution) return null;
  
  const user = getUsers().find(u => u.id === transaction.userId);
  if (!user) return null;
  
  return {
    receiptNumber: `RCPT-${Math.floor(1000 + Math.random() * 9000)}`,
    date: transaction.createdAt,
    contributionName: contribution.name,
    accountNumber: contribution.accountNumber,
    contributorName: user.name,
    amount: transaction.amount,
  };
};
