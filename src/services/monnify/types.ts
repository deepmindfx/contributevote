
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

// Simple response for error cases
export interface SimpleResponse {
  success: boolean;
  message: string;
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
  amount?: number; // Added to support both API versions
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
  customerBvn?: string;
}

// Invoice response types
export interface MonnifyInvoice {
  invoiceReference: string;
  description: string;
  amount: number;
  currencyCode: string;
  customerEmail: string;
  customerName: string;
  expiryDate?: string;
  redirectUrl: string;
  paymentReference: string;
  checkoutUrl: string;
  status: string;
  createdOn: string;
}

// Invoice creation types
export interface CreateInvoiceRequest {
  amount: number;
  customerName: string;
  customerEmail: string;
  description: string;
  invoiceReference?: string;
  paymentMethods?: string[];
  currencyCode?: string;
  contractCode?: string;
  redirectUrl?: string;
  expiryDate?: string;
  metadata?: Record<string, any>;
  incomeSplitConfig?: IncomeSplitConfig[];
}

export interface IncomeSplitConfig {
  subAccountCode: string;
  feePercentage: number;
  splitAmount: number;
  feeBearer: boolean;
}
