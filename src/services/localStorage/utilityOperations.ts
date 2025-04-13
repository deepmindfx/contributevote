
import { getUsers } from './userOperations';
import { getContributionById } from './contributionOperations';

export const updateUserBalance = (userId: string, newBalance: number) => {
  const users = getUsers();
  const userIndex = users.findIndex(user => user.id === userId);
  if (userIndex >= 0) {
    users[userIndex].walletBalance = newBalance;
    localStorage.setItem('users', JSON.stringify(users));

    // Update current user if it's the same user
    const currentUserString = localStorage.getItem('currentUser');
    if (currentUserString) {
      const currentUser = JSON.parse(currentUserString);
      if (currentUser && currentUser.id === userId) {
        currentUser.walletBalance = newBalance;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
      }
    }
  }
};

export const hasContributed = (userId: string, contributionId: string): boolean => {
  const contribution = getContributionById(contributionId);
  if (!contribution) return false;
  return contribution.contributors.some(contributor => contributor.userId === userId);
};
