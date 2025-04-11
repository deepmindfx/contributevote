
/**
 * Type definitions for wallet integration services
 */

/**
 * Interface for the reserved account data stored in user settings
 */
export interface ReservedAccountData {
  accountNumber: string;
  accountName: string;
  bankName: string;
  bankCode: string;
  reference: string;
  accountReference: string;
  reservationReference: string;
  status: string;
  createdOn: string;
  accounts?: Array<{
    bankCode: string;
    bankName: string;
    accountNumber: string;
  }>;
}

/**
 * Interface for card token data stored in user settings
 */
export interface CardTokenData {
  last4: string;
  expMonth: string;
  expYear: string;
  cardType: string;
  token: string;
  default: boolean;
  createdAt: string;
}

/**
 * Interface for invoice data
 */
export interface InvoiceData {
  invoiceReference: string;
  description: string;
  amount: number;
  currencyCode: string;
  status: string;
  customerEmail: string;
  customerName: string;
  expiryDate: string;
  redirectUrl: string;
  checkoutUrl: string;
  createdOn: string;
  createdAt: string;
  contributionId: string;
}

/**
 * Interface for payment response
 */
export interface PaymentResponse {
  status: 'success' | 'failed';
  message: string;
  data: {
    reference: string;
    amount: number;
    date: string;
  } | null;
}
