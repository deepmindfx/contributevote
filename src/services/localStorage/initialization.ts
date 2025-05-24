
import { User, Contribution, Transaction } from '../localStorage/types';
import { WithdrawalRequest } from './types';

// Initialize Local Storage
export const initializeLocalStorage = () => {
  if (!localStorage.getItem('users')) {
    localStorage.setItem('users', JSON.stringify([]));
  }
  if (!localStorage.getItem('contributions')) {
    localStorage.setItem('contributions', JSON.stringify([]));
  }
  if (!localStorage.getItem('withdrawalRequests')) {
    localStorage.setItem('withdrawalRequests', JSON.stringify([]));
  }
  if (!localStorage.getItem('transactions')) {
    localStorage.setItem('transactions', JSON.stringify([]));
  }
  if (!localStorage.getItem('notifications')) {
    localStorage.setItem('notifications', JSON.stringify([]));
  }
};

// Generate Dummy Data
export const generateDummyData = () => {
  const users: User[] = [
    {
      id: '1',
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '123-456-7890',
      role: 'user',
      walletBalance: 1000,
      preferences: {
        darkMode: false,
        anonymousContributions: false,
      },
      pin: '1234',
      accountNumber: '1234567890',
      accountName: 'John Doe',
      verified: true,
    },
    {
      id: '2',
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      phone: '987-654-3210',
      role: 'user',
      walletBalance: 500,
      preferences: {
        darkMode: true,
        anonymousContributions: true,
      },
      pin: '5678',
      accountNumber: '0987654321',
      accountName: 'Jane Smith',
      verified: true,
    },
    {
      id: '3',
      name: 'Admin User',
      email: 'admin@example.com',
      phone: '111-222-3333',
      role: 'admin',
      walletBalance: 10000,
      preferences: {
        darkMode: false,
        anonymousContributions: false,
      },
      pin: '0000',
      accountNumber: '1122334455',
      accountName: 'Admin User',
      verified: true,
    },
  ];

  const contributions: Contribution[] = [
    {
      id: '1',
      name: 'Community Garden',
      description: 'Help build a community garden for fresh produce.',
      targetAmount: 5000,
      currentAmount: 2500,
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      frequency: 'monthly',
      contributionAmount: 100, // Added required field
      category: 'community',
      creatorId: '1',
      members: ['1', '2'],
      contributors: [
        { userId: '1', amount: 500, date: '2024-02-15', anonymous: false },
        { userId: '2', amount: 200, date: '2024-02-20', anonymous: true },
      ],
      createdAt: '2024-01-01',
      accountNumber: '6012345678',
    },
    {
      id: '2',
      name: 'Family Vacation Fund',
      description: 'Save up for a memorable family vacation.',
      targetAmount: 10000,
      currentAmount: 7500,
      startDate: '2024-03-01',
      endDate: '2024-12-31',
      frequency: 'weekly',
      contributionAmount: 200, // Added required field
      category: 'family',
      creatorId: '2',
      members: ['2'],
      contributors: [
        { userId: '2', amount: 1000, date: '2024-03-05', anonymous: false },
      ],
      createdAt: '2024-03-01',
      accountNumber: '6087654321',
    },
  ];

  const withdrawalRequests: WithdrawalRequest[] = [
    {
      id: '1',
      contributionId: '1',
      amount: 1000,
      reason: 'Purchase gardening tools',
      status: 'pending',
      votes: [
        { userId: '1', vote: 'approve' },
        { userId: '2', vote: 'reject' },
      ],
      createdAt: '2024-02-28',
      deadline: '2024-03-07',
      beneficiary: 'John Doe',
      accountNumber: '1234567890',
      bankName: 'CollectiPay Bank',
      purpose: 'Purchase gardening tools',
    },
  ];

  const transactions: Transaction[] = [
    {
      id: '1',
      contributionId: '1',
      userId: '1',
      type: 'deposit',
      amount: 500,
      description: 'Contribution to Community Garden',
      createdAt: '2024-02-15',
      status: 'completed',
      anonymous: false,
    },
    {
      id: '2',
      contributionId: '2',
      userId: '2',
      type: 'deposit',
      amount: 1000,
      description: 'Contribution to Family Vacation Fund',
      createdAt: '2024-03-05',
      status: 'completed',
      anonymous: false,
    },
    {
      id: '3',
      contributionId: '1',
      userId: '1',
      type: 'withdrawal',
      amount: 1000,
      description: 'Withdrawal for gardening tools',
      createdAt: '2024-03-01',
      status: 'pending',
    },
  ];

  localStorage.setItem('users', JSON.stringify(users));
  localStorage.setItem('contributions', JSON.stringify(contributions));
  localStorage.setItem('withdrawalRequests', JSON.stringify(withdrawalRequests));
  localStorage.setItem('transactions', JSON.stringify(transactions));
};
