export interface ReservedAccountData {
  accountNumber: string;
  bankName: string;
  accountName: string;
  flwRef: string;
  orderRef: string;
  createdAt: string;
}

export interface CardTokenData {
  token: string;
  lastFourDigits: string;
  expiryMonth: string;
  expiryYear: string;
  issuer: string;
  cardType: string;
  createdOn: string;
}

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
