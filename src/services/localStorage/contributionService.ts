
import { v4 as uuidv4 } from "uuid";
import { Contribution, localStorageKeys } from "./types";
import { getCurrentUser } from "./userService";

/**
 * Function to get all contributions
 */
export const getContributions = (): Contribution[] => {
  const contributionsString = localStorage.getItem(localStorageKeys.contributions);
  if (!contributionsString) return [];
  return JSON.parse(contributionsString);
};

/**
 * Function to get user contributions
 */
export const getUserContributions = (userId: string): Contribution[] => {
  const contributions = getContributions();
  if (!contributions) return [];
  return contributions.filter(c => c.creatorId === userId || c.members?.includes(userId));
};

/**
 * Function to get contribution by ID
 */
export const getContributionById = (id: string): Contribution | undefined => {
  const contributions = getContributions();
  return contributions.find(contribution => contribution.id === id);
};

/**
 * Function to create a new contribution
 */
export const createContribution = (contributionData: any): Contribution => {
  const contributions = getContributions();
  const newContribution = {
    id: uuidv4(),
    ...contributionData,
    currentAmount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  localStorage.setItem(localStorageKeys.contributions, JSON.stringify([...contributions, newContribution]));
  return newContribution;
};

/**
 * Function to update a contribution
 */
export const updateContribution = (id: string, updatedData: Partial<Contribution>): Contribution | undefined => {
  const contributions = getContributions();
  const updatedContributions = contributions.map(contribution => {
    if (contribution.id === id) {
      return { ...contribution, ...updatedData, updatedAt: new Date().toISOString() };
    }
    return contribution;
  });
  
  localStorage.setItem(localStorageKeys.contributions, JSON.stringify(updatedContributions));
  return getContributionById(id);
};

/**
 * Function to get a contribution by account number
 */
export const getContributionByAccountNumber = (accountNumber: string): Contribution | null => {
  const contributions = getContributions();
  return contributions.find(c => c.accountNumber === accountNumber) || null;
};

/**
 * Function to generate a share link for a contribution
 */
export const generateShareLink = (contributionId: string): string => {
  return `${window.location.origin}/contribute/share/${contributionId}`;
};

/**
 * Function to check if a user is the creator of a group
 */
export const isGroupCreator = (contributionId: string): boolean => {
  const currentUser = getCurrentUser();
  const contribution = getContributionById(contributionId);
  return !!(currentUser && contribution && contribution.creatorId === currentUser.id);
};
