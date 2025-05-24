
export interface ReservedAccountData {
  accountNumber: string;
  accountName: string;
  bankName: string;
  accountReference?: string;
  flwRef?: string;
  accounts?: Array<{
    accountNumber: string;
    bankName: string;
    accountName?: string;
  }>;
}

export interface WalletTransaction {
  id: string;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'transfer';
  status: 'pending' | 'successful' | 'failed';
  createdAt: string;
  reference?: string;
  description?: string;
}
