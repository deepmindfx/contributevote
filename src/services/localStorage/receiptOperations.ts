
import { getBaseUsers } from './storageUtils';
import { getTransactions } from './transactionOperations';
import { getBaseContributionById } from './storageUtils';

export const generateContributionReceipt = (transactionId: string) => {
  const transactions = getTransactions();
  const transaction = transactions.find(t => t.id === transactionId);
  
  if (!transaction) return null;
  
  const users = getBaseUsers();
  const user = users.find(u => u.id === transaction.userId);
  
  // For contributions, include contribution details
  if (transaction.contributionId) {
    const contribution = getBaseContributionById(transaction.contributionId);
    
    if (!contribution) return null;
    
    return {
      receiptNumber: `RCT-${transaction.reference || transaction.id.substring(0, 8).toUpperCase()}`,
      date: new Date(transaction.createdAt).toISOString(),
      amount: transaction.amount,
      payerName: transaction.anonymous ? 'Anonymous' : (user?.name || transaction.metaData?.senderName || 'Anonymous'),
      payerEmail: transaction.anonymous ? 'Anonymous' : (user?.email || 'N/A'),
      contributionName: contribution.name,
      contributionId: contribution.id,
      accountNumber: contribution.accountNumber || 'N/A',
      transactionId: transaction.id,
      status: transaction.status || 'completed',
      reference: transaction.reference || transaction.id,
      paymentMethod: transaction.paymentMethod || 'Bank Transfer',
      description: transaction.description || `Contribution to ${contribution.name}`,
    };
  } 
  // For wallet top-ups, just include transaction details
  else if (transaction.type === 'deposit') {
    return {
      receiptNumber: `RCT-${transaction.reference || transaction.id.substring(0, 8).toUpperCase()}`,
      date: new Date(transaction.createdAt).toISOString(),
      amount: transaction.amount,
      payerName: user?.name || transaction.metaData?.senderName || 'Anonymous',
      payerEmail: user?.email || 'N/A',
      description: 'Wallet top-up',
      transactionId: transaction.id,
      status: transaction.status || 'completed',
      reference: transaction.reference || transaction.id,
      paymentMethod: transaction.paymentMethod || 'Bank Transfer',
    };
  }
  
  return null;
};
