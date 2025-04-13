
import { v4 as uuidv4 } from 'uuid';
import { Contribution } from './types';
import { getCurrentUser } from './userOperations';
import { updateUserBalance } from './utilityOperations';
import { createTransaction } from './transactionOperations';
import { getContributionByAccountNumber } from '@/localStorage';

export const getContributions = (): Contribution[] => {
  const contributionsString = localStorage.getItem('contributions');
  return contributionsString ? JSON.parse(contributionsString) : [];
};

export const getUserContributions = (userId: string): Contribution[] => {
  const contributions = getContributions();
  return contributions.filter(contribution => contribution.members.includes(userId));
};

export const getContributionById = (id: string): Contribution | undefined => {
  const contributions = getContributions();
  return contributions.find(contribution => contribution.id === id);
};

export const createContribution = (contribution: Omit<Contribution, 'id' | 'createdAt' | 'currentAmount' | 'members' | 'contributors' | 'accountNumber'>) => {
  const contributions = getContributions();
  const newContribution: Contribution = {
    id: uuidv4(),
    currentAmount: 0,
    members: [getCurrentUser().id],
    contributors: [],
    createdAt: new Date().toISOString(),
    accountNumber: `60${Math.floor(10000000 + Math.random() * 90000000)}`,
    ...contribution,
  };
  contributions.push(newContribution);
  localStorage.setItem('contributions', JSON.stringify(contributions));
  return newContribution;
};

export const updateContribution = (id: string, contributionData: Partial<Contribution>) => {
  const contributions = getContributions();
  const contributionIndex = contributions.findIndex(contribution => contribution.id === id);
  if (contributionIndex >= 0) {
    contributions[contributionIndex] = { ...contributions[contributionIndex], ...contributionData };
    localStorage.setItem('contributions', JSON.stringify(contributions));
  }
};

export const contributeToGroup = (contributionId: string, amount: number, anonymous: boolean = false) => {
  const user = getCurrentUser();
  if (!user) throw new Error('User not logged in');

  const contribution = getContributionById(contributionId);
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
  });
};

export const contributeByAccountNumber = (accountNumber: string, amount: number, contributorInfo: { name: string, email?: string, phone?: string }, anonymous: boolean = false) => {
  const user = getCurrentUser();
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
  });
};

export const generateShareLink = (contributionId: string): string => {
  return `${window.location.origin}/contribute/share/${contributionId}`;
};
