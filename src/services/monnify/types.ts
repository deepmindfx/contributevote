
/**
 * Types for Monnify API services
 */

// Basic API response structure
export interface MonnifyApiResponse<T = any> {
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
  responseBody: T;
}

// Account response types
export interface MonnifyAccountDetails {
  accountReference: string;
  accountName: string;
  currencyCode: string;
  contractCode: string;
  customerEmail: string;
  customerName: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
  reservationReference: string;
  status: string;
  createdOn: string;
  accounts?: Array<{
    bankCode: string;
    bankName: string;
    accountNumber: string;
  }>;
}

// Transaction response types
export interface MonnifyTransaction {
  transactionReference: string;
  paymentReference: string;
  amountPaid: number;
  totalPayable: number;
  settlementAmount: number;
  paidOn: string;
  paymentStatus: string;
  paymentDescription: string;
  transactionHash: string;
  currency: string;
  paymentMethod: string;
  sourceAccountName?: string;
  sourceAccountNumber?: string;
  sourceBankName?: string;
  destinationAccountName?: string;
  destinationAccountNumber?: string;
  destinationBankName?: string;
}

export interface MonnifyTransactionResponse {
  content: MonnifyTransaction[];
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Request types
export interface CreateReservedAccountRequest {
  accountReference: string;
  accountName: string;
  currencyCode: string;
  contractCode: string;
  customerEmail: string;
  customerName: string;
  customerBvn?: string;
  customerNin?: string;
  getAllAvailableBanks?: boolean;
  preferredBanks?: string[];
}

export interface CreateGroupAccountRequest {
  accountReference: string;
  accountName: string;
  currencyCode: string;
  contractCode: string;
  customerEmail: string;
  customerName: string;
  customerBvn: string;
}

// Simple response for error cases
export interface SimpleResponse {
  success: boolean;
  message: string;
}
