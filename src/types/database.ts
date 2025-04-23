
export interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  wallet_balance: number;
  created_at: string;
  updated_at: string;
  status: 'active' | 'inactive';
  role: 'user' | 'admin';
  preferences: {
    darkMode?: boolean;
    notifications?: boolean;
    anonymousContributions?: boolean;
  };
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
  status: 'active' | 'completed' | 'paused';
  created_at: string;
  updated_at: string;
  account_number: string | null;
  bank_name: string | null;
  account_name: string | null;
  account_reference: string | null;
  account_details: any | null;
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
  user_id: string;
  contribution_id: string | null;
  type: 'deposit' | 'withdrawal' | 'contribution' | 'refund';
  amount: number;
  description: string | null;
  status: 'pending' | 'completed' | 'failed';
  reference_id: string;
  payment_method: string;
  created_at: string;
  updated_at: string;
  anonymous: boolean;
  metadata: any | null;
}

export interface WithdrawalRequest {
  id: string;
  contribution_id: string;
  requester_id: string;
  amount: number;
  purpose: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  created_at: string;
  deadline: string | null;
  votes: Record<string, 'approve' | 'reject'>;
}

export interface Notification {
  id: string;
  user_id: string;
  message: string;
  related_id: string | null;
  created_at: string;
  is_read: boolean;
}
