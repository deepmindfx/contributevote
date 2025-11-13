// Re-export all Flutterwave API functionality from modular files

// Export constants and config
export { BASE_URL, SECRET_KEY, PUBLIC_KEY, ENCRYPTION_KEY } from './flutterwave/config';

// Export virtual accounts functionality
export {
  createVirtualAccount,
  verifyTransaction,
  createGroupVirtualAccount
} from './flutterwave/virtualAccounts';

// Export invoice functionality
export { createInvoice } from './flutterwave/invoices';

// Stub implementations for missing functions (to be implemented)
export const getReservedAccountDetails = async (accountReference: string) => {
  console.warn('getReservedAccountDetails not yet implemented');
  return { success: false, message: 'Not implemented' };
};

export const getReservedAccountTransactions = async (accountReference: string) => {
  console.warn('getReservedAccountTransactions not yet implemented');
  return { success: false, message: 'Not implemented' };
}; 