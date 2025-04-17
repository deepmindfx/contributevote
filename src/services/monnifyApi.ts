
// Re-export all Monnify API functionality from modular files

// Export constants and config
export { BASE_URL, API_KEY, SECRET_KEY, CONTRACT_CODE, getEncodedCredentials } from './monnify/config';

// Export auth functionality
export { getAuthToken } from './monnify/auth';

// Export reserved accounts functionality
export {
  createReservedAccount,
  createContributionGroupAccount,
  getReservedAccountDetails,
  getReservedAccountTransactions,
  // Export types
  type MonnifyAccountDetails,
  type MonnifyTransaction,
  type MonnifyTransactionResponse,
  type CreateReservedAccountRequest,
  type CreateGroupAccountRequest,
} from './monnify/reservedAccounts';

// Export payment functionality
export {
  createInvoice,
  chargeCardToken
} from './monnify/payments';
