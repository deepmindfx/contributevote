
export interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  wallet_balance: number;
  created_at: string;
  updated_at: string;
  status: 'active' | 'inactive';
  role: 'user' | 'admin';
  preferences: Record<string, any>;
}

export interface ContributionGroup {
  id: string;
  creator_id: string;
  name: string;
  description: string | null;
  target_amount: number;
  current_amount: number;
  category: 'personal' | 'business' | 'family' | 'event' | 'education' | 'other';
  frequency: 'daily' | 'weekly' | 'monthly' | 'one-time';
  contribution_amount: number | null;
  start_date: string | null;
  end_date: string | null;
  voting_threshold: number;
  privacy: 'public' | 'private';
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  account_number: string | null;
  bank_name: string | null;
  account_name: string | null;
  account_reference: string | null;
  account_details: Record<string, any> | null;
}

export interface Contributor {
  id: string;
  group_id: string;
  user_id: string;
  amount: number;
  date: string;
  anonymous: boolean;
}

export interface Transaction {
  id: string;
  user_id: string | null;
  contribution_id: string | null;
  type: 'deposit' | 'withdrawal' | 'contribution' | 'refund';
  amount: number;
  description: string | null;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  reference_id: string | null;
  payment_method: string | null;
  created_at: string;
  updated_at: string;
  anonymous: boolean;
  metadata: Record<string, any> | null;
}

export interface WithdrawalRequest {
  id: string;
  contribution_id: string | null;
  requester_id: string | null;
  amount: number;
  purpose: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed';
  created_at: string;
  deadline: string | null;
  votes: Record<string, 'approve' | 'reject'>;
}

export interface Notification {
  id: string;
  user_id: string | null;
  message: string;
  related_id: string | null;
  created_at: string;
  is_read: boolean;
}

export interface ReservedAccountData {
  accountNumber?: string;
  bankName?: string;
  accountName?: string;
  accountReference?: string;
  accounts?: Array<{
    accountNumber: string;
    bankName: string;
  }>;
}
