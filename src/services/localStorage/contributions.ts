
import { v4 as uuidv4 } from 'uuid';
import { Contribution, User } from './types';
import { getCurrentUser, getUsers } from './users';
import { createTransaction } from './transactions';
import { validateDate } from './utils';

export const getContributions = (): Contribution[] => {
  try {
    const contributionsString = localStorage.getItem('contributions');
    return contributionsString ? JSON.parse(contributionsString) : [];
  } catch (error) {
    console.error("Error getting contributions:", error);
    return [];
  }
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
    members: [getCurrentUser()?.id || ''],
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

export const hasContributed = (userId: string, contributionId: string): boolean => {
  const contribution = getContributionById(contributionId);
  if (!contribution) return false;
  return contribution.contributors.some(contributor => contributor.userId === userId);
};

export const contributeToGroup = (contributionId: string, amount: number, anonymous: boolean = false) => {
  const user = getCurrentUser();
  if (!user) throw new Error('User not logged in');

  const contribution = getContributionById(contributionId);
  if (!contribution) throw new Error('Contribution group not found');

  if (user.walletBalance < amount) throw new Error('Insufficient funds in your wallet');

  // Update user's wallet balance
  const users = getUsers();
  const userIndex = users.findIndex(u => u.id === user.id);
  if (userIndex >= 0) {
    users[userIndex].walletBalance -= amount;
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('currentUser', JSON.stringify(users[userIndex]));
  }

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
  const users = getUsers();
  const userIndex = users.findIndex(u => u.id === user.id);
  if (userIndex >= 0) {
    users[userIndex].walletBalance -= amount;
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('currentUser', JSON.stringify(users[userIndex]));
  }
  
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

export const getContributionByAccountNumber = (accountNumber: string) => {
  try {
    const contributionsString = localStorage.getItem('contributions');
    if (!contributionsString) return null;
    
    const contributions = JSON.parse(contributionsString);
    return contributions.find((c: any) => c.accountNumber === accountNumber) || null;
  } catch (error) {
    console.error("Error in getContributionByAccountNumber:", error);
    return null;
  }
};

export const ensureAccountNumberDisplay = () => {
  try {
    const contributionsString = localStorage.getItem('contributions');
    if (!contributionsString) return;
    
    const contributions = JSON.parse(contributionsString);
    let updated = false;
    
    contributions.forEach((contribution: any) => {
      // If no account number exists, create a unique one
      if (!contribution.accountNumber) {
        // Generate a unique 10-digit account number starting with 60
        contribution.accountNumber = `60${Math.floor(10000000 + Math.random() * 90000000)}`;
        updated = true;
        console.log(`Generated new account number ${contribution.accountNumber} for ${contribution.name}`);
      }
    });
    
    if (updated) {
      localStorage.setItem('contributions', JSON.stringify(contributions));
      console.log('Updated contribution account numbers:', contributions);
    }
    
    // For debugging - return the contributions
    return contributions;
  } catch (error) {
    console.error("Error ensuring account numbers:", error);
    return null;
  }
};

// Just to get TypeScript to recognize we're exporting ensureAccountNumberDisplay
export const reExportEnsureAccountNumberDisplay = () => {
  return ensureAccountNumberDisplay;
};

export const generateShareLink = (contributionId: string): string => {
  return `${window.location.origin}/contribute/share/${contributionId}`;
};
