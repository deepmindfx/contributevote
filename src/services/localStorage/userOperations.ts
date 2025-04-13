
import { User } from './types';
import { v4 as uuidv4 } from 'uuid';

export const getCurrentUser = (): User => {
  const userString = localStorage.getItem('currentUser');
  return userString ? JSON.parse(userString) : null;
};

export const getUsers = (): User[] => {
  const usersString = localStorage.getItem('users');
  return usersString ? JSON.parse(usersString) : [];
};

export const createUser = (user: Omit<User, 'id' | 'role' | 'walletBalance' | 'preferences'>) => {
  const users = getUsers();
  const newUser: User = {
    id: uuidv4(),
    role: 'user',
    walletBalance: 0,
    preferences: {
      darkMode: false,
      anonymousContributions: false,
    },
    verified: false,
    ...user,
  };
  users.push(newUser);
  localStorage.setItem('users', JSON.stringify(users));
  localStorage.setItem('currentUser', JSON.stringify(newUser));
};

export const setCurrentUser = (user: User) => {
  localStorage.setItem('currentUser', JSON.stringify(user));
};

export const logoutUser = () => {
  localStorage.removeItem('currentUser');
};

export const updateUser = (userData: Partial<User>) => {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  const updatedUser = { ...currentUser, ...userData };
  localStorage.setItem('currentUser', JSON.stringify(updatedUser));

  const users = getUsers();
  const userIndex = users.findIndex(user => user.id === currentUser.id);
  if (userIndex >= 0) {
    users[userIndex] = updatedUser;
    localStorage.setItem('users', JSON.stringify(users));
  }
};

export const updateUserById = (userId: string, userData: Partial<User>) => {
  const users = getUsers();
  const userIndex = users.findIndex(user => user.id === userId);
  if (userIndex >= 0) {
    users[userIndex] = { ...users[userIndex], ...userData };
    localStorage.setItem('users', JSON.stringify(users));

    // Also update currentUser if it's the same user
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      localStorage.setItem('currentUser', JSON.stringify(users[userIndex]));
    }
  }
};

export const pauseUser = (userId: string) => {
  updateUserById(userId, { role: 'paused' as any });
};

export const activateUser = (userId: string) => {
  updateUserById(userId, { role: 'user' });
};

export const depositToUser = (userId: string, amount: number) => {
  const users = getUsers();
  const userIndex = users.findIndex(user => user.id === userId);
  if (userIndex >= 0) {
    users[userIndex].walletBalance += amount;
    localStorage.setItem('users', JSON.stringify(users));

    // Also update currentUser if it's the same user
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      updateUser({ walletBalance: users[userIndex].walletBalance });
    }
  }
};

export const getUserByEmail = (email: string): User | null => {
  const users = getUsers();
  return users.find(user => user.email === email) || null;
};

export const getUserByPhone = (phone: string): User | null => {
  const users = getUsers();
  return users.find(user => user.phone === phone) || null;
};
