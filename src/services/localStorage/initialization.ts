
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

// This function will be disabled to prevent generating dummy data
export const generateDummyData = () => {
  // This function is now disabled to prevent generating mock data
  console.log("Dummy data generation is disabled");
  return;
};

