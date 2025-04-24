
import { v4 as uuidv4 } from 'uuid';
import { User } from './types';
import { getBaseUsers, getBaseCurrentUser } from './storageUtils';
import { addNotification } from './notificationOperations';
import { createTransaction } from './transactionOperations';

export const getUsers = (): User[] => {
  return getBaseUsers();
};

export const createUser = (user: Omit<User, 'id' | 'walletBalance' | 'role' | 'verified'>): User => {
  const users = getBaseUsers();
  const newUser: User = {
    id: uuidv4(),
    walletBalance: 0,
    role: 'user',
    verified: false,
    ...user,
  };
  users.push(newUser);
  localStorage.setItem('users', JSON.stringify(users));
  return newUser;
};

export const setCurrentUser = (user: User) => {
  localStorage.setItem('currentUser', JSON.stringify(user));
};

export const logoutUser = () => {
  localStorage.removeItem('currentUser');
};

export const updateUser = (userData: Partial<User>) => {
  const currentUser = getBaseCurrentUser();
  if (!currentUser) throw new Error('No user logged in');

  const updatedUser = { ...currentUser, ...userData };
  localStorage.setItem('currentUser', JSON.stringify(updatedUser));

  const users = getBaseUsers();
  const userIndex = users.findIndex(user => user.id === currentUser.id);
  if (userIndex >= 0) {
    users[userIndex] = updatedUser;
    localStorage.setItem('users', JSON.stringify(users));
  }
};

export const updateUserById = (id: string, userData: Partial<User>) => {
  const users = getBaseUsers();
  const userIndex = users.findIndex(user => user.id === id);
  if (userIndex >= 0) {
    users[userIndex] = { ...users[userIndex], ...userData };
    localStorage.setItem('users', JSON.stringify(users));
  }
};

export const pauseUser = (userId: string) => {
  updateUserById(userId, { status: 'paused', role: 'user' });
};

export const activateUser = (userId: string) => {
  updateUserById(userId, { status: 'active', role: 'user' });
};

export const depositToUser = (userId: string, amount: number) => {
  const users = getBaseUsers();
  const userIndex = users.findIndex(user => user.id === userId);
  if (userIndex >= 0) {
    users[userIndex].walletBalance += amount;
    localStorage.setItem('users', JSON.stringify(users));

    // Create a transaction record
    createTransaction({
      userId,
      type: 'deposit',
      amount,
      description: `Admin deposit`,
      status: 'completed',
      referenceId: `DEP-${Date.now()}`,
      paymentMethod: 'admin',
      updatedAt: new Date().toISOString(),
    });
  }
};

export const getUserByEmail = (email: string): User | null => {
  const users = getBaseUsers();
  const foundUser = users.find(user => user.email === email);
  return foundUser || null;
};

export const getUserByPhone = (phone: string): User | null => {
  const users = getBaseUsers();
  const foundUser = users.find(user => user.phone === phone);
  return foundUser || null;
};
