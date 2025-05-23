
import { v4 as uuidv4 } from 'uuid';
import { Contribution } from './types';
import { getBaseCurrentUser, getBaseContributions, getBaseContributionById } from './storageUtils';
import { updateUserBalance } from './utilityOperations';
import { createTransaction } from './transactionOperations';
import { getContributionByAccountNumber } from '@/localStorage';

export const getContributions = (): Contribution[] => {
  return getBaseContributions();
};

export const getUserContributions = (userId: string): Contribution[] => {
  try {
    if (!userId) return [];
    
    const contributions = getBaseContributions();
    return contributions.filter(contribution => contribution.members.includes(userId));
  } catch (error) {
    console.error("Error getting user contributions:", error);
    return [];
  }
};

export const getContributionById = (id: string): Contribution | undefined => {
  return getBaseContributionById(id);
};

export const createContribution = (contribution: Omit<Contribution, 'id' | 'createdAt' | 'currentAmount' | 'members' | 'contributors'>) => {
  const contributions = getBaseContributions();
  const currentUser = getBaseCurrentUser();
  if (!currentUser) throw new Error('User not logged in');
  
  // Make sure accountNumber is provided if it's available in the input
  const accountNumber = contribution.accountNumber || `60${Math.floor(10000000 + Math.random() * 90000000)}`;
  
  const newContribution: Contribution = {
    id: uuidv4(),
    currentAmount: 0,
    members: [currentUser.id],
    contributors: [],
    createdAt: new Date().toISOString(),
    accountNumber,
    ...contribution,
  };
  
  // Ensure we store account reference if it's available
  if (contribution.accountReference) {
    console.log(`Storing account reference ${contribution.accountReference} for contribution`);
  }
  
  contributions.push(newContribution);
  localStorage.setItem('contributions', JSON.stringify(contributions));
  return newContribution;
};

export const updateContribution = (id: string, contributionData: Partial<Contribution>) => {
  const contributions = getBaseContributions();
  const contributionIndex = contributions.findIndex(contribution => contribution.id === id);
  if (contributionIndex >= 0) {
    contributions[contributionIndex] = { ...contributions[contributionIndex], ...contributionData };
    localStorage.setItem('contributions', JSON.stringify(contributions));
  }
};

export const contributeToGroup = (contributionId: string, amount: number, anonymous: boolean = false) => {
  const user = getBaseCurrentUser();
  if (!user) throw new Error('User not logged in');

  const contribution = getBaseContributionById(contributionId);
  if (!contribution) throw new Error('Contribution group not found');

  if (user.walletBalance < amount) throw new Error('Insufficient funds in your wallet');

  // Update user's wallet balance
  updateUserBalance(user.id, user.walletBalance - amount);

  // Add contribution to the group
  contribution.currentAmount += amount;

  // Add contributor to the contribution group
  const date = new Date().toISOString();
  contribution.contributors.push({
    userId: user.id,
    amount,
    date,
    anonymous,
  });

  // Update contribution in local storage
  updateContribution(contributionId, {
    currentAmount: contribution.currentAmount,
    contributors: contribution.contributors,
  });

  // Create a transaction record
  createTransaction({
    contributionId,
    userId: user.id,
    type: 'deposit',
    amount,
    description: `Contribution to ${contribution.name}`,
    anonymous,
    status: 'completed',
    metaData: {
      accountNumber: contribution.accountNumber,
      accountReference: contribution.accountReference
    }
  });
};

export const contributeByAccountNumber = (accountNumber: string, amount: number, contributorInfo: { name: string, email?: string, phone?: string }, anonymous: boolean = false) => {
  const user = getBaseCurrentUser();
  const contribution = getContributionByAccountNumber(accountNumber);
  
  if (!contribution) {
    throw new Error('Contribution group not found with this account number');
  }
  
  // For simplicity, we'll assume the user is logged in and has sufficient balance
  if (!user) {
    throw new Error('User not logged in');
  }
  
  if (user.walletBalance < amount) {
    throw new Error('Insufficient funds in your wallet');
  }
  
  // Update user's wallet balance
  updateUserBalance(user.id, user.walletBalance - amount);
  
  // Add contribution to the group
  contribution.currentAmount += amount;
  
  // Add contributor to the contribution group
  const date = new Date().toISOString();
  contribution.contributors.push({
    name: contributorInfo.name,
    email: contributorInfo.email,
    phone: contributorInfo.phone,
    amount,
    date,
    anonymous,
  });
  
  // Update contribution in local storage
  updateContribution(contribution.id, {
    currentAmount: contribution.currentAmount,
    contributors: contribution.contributors,
  });
  
  // Create a transaction record
  createTransaction({
    contributionId: contribution.id,
    userId: user.id,
    type: 'deposit',
    amount,
    description: `Contribution to ${contribution.name}`,
    anonymous,
    status: 'completed',
    metaData: {
      accountNumber: contribution.accountNumber,
      accountReference: contribution.accountReference || undefined
    }
  });
};

export const generateShareLink = (contributionId: string): string => {
  return `${window.location.origin}/contribute/share/${contributionId}`;
};
