
import { v4 as uuidv4 } from 'uuid';

export interface User {
  id: string;
  name: string;
  email: string;
  walletBalance: number;
}

export interface Contribution {
  id: string;
  name: string;
  description: string;
  targetAmount: number;
  currentAmount: number;
  creatorId: string;
  createdAt: string;
  category: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'one-time';
  contributionAmount: number;
  startDate: string;
  endDate?: string;
  votingThreshold: number;
  privacy: 'public' | 'private';
  memberRoles: 'equal' | 'weighted';
  members: string[];
}

export interface WithdrawalRequest {
  id: string;
  contributionId: string;
  requesterId: string;
  amount: number;
  purpose: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  votes: { 
    userId: string; 
    vote: 'approve' | 'reject';
  }[];
}

export interface Transaction {
  id: string;
  userId: string;
  contributionId: string;
  type: 'deposit' | 'withdrawal' | 'vote';
  amount: number;
  status: 'pending' | 'completed' | 'rejected';
  description: string;
  createdAt: string;
  relatedId?: string;  // for withdrawal requests or votes
}

// Initialize default user
const initializeUser = (): User => {
  const defaultUser = {
    id: uuidv4(),
    name: 'John Doe',
    email: 'john@example.com',
    walletBalance: 500000,
  };
  
  localStorage.setItem('currentUser', JSON.stringify(defaultUser));
  return defaultUser;
};

// User methods
export const getCurrentUser = (): User => {
  const userString = localStorage.getItem('currentUser');
  if (!userString) {
    return initializeUser();
  }
  return JSON.parse(userString);
};

export const updateUserBalance = (amount: number): User => {
  const user = getCurrentUser();
  user.walletBalance += amount;
  localStorage.setItem('currentUser', JSON.stringify(user));
  return user;
};

// Contribution methods
export const getContributions = (): Contribution[] => {
  const contributionsString = localStorage.getItem('contributions');
  if (!contributionsString) {
    return [];
  }
  return JSON.parse(contributionsString);
};

export const getContribution = (id: string): Contribution | null => {
  const contributions = getContributions();
  return contributions.find(c => c.id === id) || null;
};

export const createContribution = (contribution: Omit<Contribution, 'id' | 'createdAt' | 'currentAmount' | 'members'>): Contribution => {
  const contributions = getContributions();
  const currentUser = getCurrentUser();
  
  const newContribution: Contribution = {
    ...contribution,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    currentAmount: 0,
    members: [currentUser.id],
  };
  
  contributions.push(newContribution);
  localStorage.setItem('contributions', JSON.stringify(contributions));
  
  // Create initial transaction
  addTransaction({
    userId: currentUser.id,
    contributionId: newContribution.id,
    type: 'deposit',
    amount: 0,
    status: 'completed',
    description: `Created ${newContribution.name} contribution group`,
    createdAt: new Date().toISOString(),
  });
  
  return newContribution;
};

export const contributeToGroup = (contributionId: string, amount: number): Contribution => {
  const contributions = getContributions();
  const currentUser = getCurrentUser();
  
  // Deduct from user's wallet
  updateUserBalance(-amount);
  
  // Update contribution
  const index = contributions.findIndex(c => c.id === contributionId);
  if (index >= 0) {
    contributions[index].currentAmount += amount;
    localStorage.setItem('contributions', JSON.stringify(contributions));
    
    // Add transaction
    addTransaction({
      userId: currentUser.id,
      contributionId,
      type: 'deposit',
      amount,
      status: 'completed',
      description: `Contributed to ${contributions[index].name}`,
      createdAt: new Date().toISOString(),
    });
    
    return contributions[index];
  }
  
  throw new Error('Contribution not found');
};

// Withdrawal request methods
export const getWithdrawalRequests = (): WithdrawalRequest[] => {
  const requestsString = localStorage.getItem('withdrawalRequests');
  if (!requestsString) {
    return [];
  }
  return JSON.parse(requestsString);
};

export const getWithdrawalRequestsForContribution = (contributionId: string): WithdrawalRequest[] => {
  const requests = getWithdrawalRequests();
  return requests.filter(r => r.contributionId === contributionId);
};

export const createWithdrawalRequest = (request: Omit<WithdrawalRequest, 'id' | 'createdAt' | 'status' | 'votes'>): WithdrawalRequest => {
  const requests = getWithdrawalRequests();
  const currentUser = getCurrentUser();
  
  const newRequest: WithdrawalRequest = {
    ...request,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    status: 'pending',
    votes: [],
  };
  
  requests.push(newRequest);
  localStorage.setItem('withdrawalRequests', JSON.stringify(requests));
  
  // Create transaction for withdrawal request
  addTransaction({
    userId: currentUser.id,
    contributionId: request.contributionId,
    type: 'vote',
    amount: request.amount,
    status: 'pending',
    description: `Withdrawal request: ${request.purpose}`,
    createdAt: new Date().toISOString(),
    relatedId: newRequest.id,
  });
  
  return newRequest;
};

export const voteOnWithdrawalRequest = (requestId: string, vote: 'approve' | 'reject'): WithdrawalRequest => {
  const requests = getWithdrawalRequests();
  const currentUser = getCurrentUser();
  
  const index = requests.findIndex(r => r.id === requestId);
  if (index >= 0) {
    // Remove existing vote if any
    requests[index].votes = requests[index].votes.filter(v => v.userId !== currentUser.id);
    
    // Add new vote
    requests[index].votes.push({
      userId: currentUser.id,
      vote,
    });
    
    // Check if threshold is reached
    const contribution = getContribution(requests[index].contributionId);
    if (contribution) {
      const approvalVotes = requests[index].votes.filter(v => v.vote === 'approve').length;
      const totalMembers = contribution.members.length;
      const approvalPercentage = (approvalVotes / totalMembers) * 100;
      
      if (approvalPercentage >= contribution.votingThreshold) {
        // Approve and process withdrawal
        requests[index].status = 'approved';
        
        // Update contribution amount
        const contributions = getContributions();
        const contribIndex = contributions.findIndex(c => c.id === contribution.id);
        contributions[contribIndex].currentAmount -= requests[index].amount;
        localStorage.setItem('contributions', JSON.stringify(contributions));
        
        // Add transaction
        addTransaction({
          userId: requests[index].requesterId,
          contributionId: contribution.id,
          type: 'withdrawal',
          amount: requests[index].amount,
          status: 'completed',
          description: `Withdrawal for: ${requests[index].purpose}`,
          createdAt: new Date().toISOString(),
          relatedId: requestId,
        });
      } else if (requests[index].votes.length === totalMembers && approvalPercentage < contribution.votingThreshold) {
        // Everyone has voted but threshold not met
        requests[index].status = 'rejected';
      }
    }
    
    localStorage.setItem('withdrawalRequests', JSON.stringify(requests));
    
    // Add vote transaction
    addTransaction({
      userId: currentUser.id,
      contributionId: requests[index].contributionId,
      type: 'vote',
      amount: 0,
      status: 'completed',
      description: `Voted ${vote} on withdrawal request`,
      createdAt: new Date().toISOString(),
      relatedId: requestId,
    });
    
    return requests[index];
  }
  
  throw new Error('Withdrawal request not found');
};

// Transaction methods
export const getTransactions = (): Transaction[] => {
  const transactionsString = localStorage.getItem('transactions');
  if (!transactionsString) {
    return [];
  }
  return JSON.parse(transactionsString);
};

export const getTransactionsForUser = (userId: string): Transaction[] => {
  const transactions = getTransactions();
  return transactions.filter(t => t.userId === userId);
};

export const getTransactionsForContribution = (contributionId: string): Transaction[] => {
  const transactions = getTransactions();
  return transactions.filter(t => t.contributionId === contributionId);
};

export const addTransaction = (transaction: Omit<Transaction, 'id'>): Transaction => {
  const transactions = getTransactions();
  
  const newTransaction: Transaction = {
    ...transaction,
    id: uuidv4(),
  };
  
  transactions.push(newTransaction);
  localStorage.setItem('transactions', JSON.stringify(transactions));
  
  return newTransaction;
};

// Share methods
export const generateShareLink = (contributionId: string): string => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/contribute/${contributionId}`;
};

// Initialize with sample data if empty
export const initializeLocalStorage = () => {
  if (!localStorage.getItem('currentUser')) {
    initializeUser();
  }
  
  if (!localStorage.getItem('contributions')) {
    const currentUser = getCurrentUser();
    const sampleContributions: Contribution[] = [
      {
        id: '1',
        name: 'Wedding Fund',
        description: 'Saving for our dream wedding next year',
        targetAmount: 1500000,
        currentAmount: 750000,
        creatorId: currentUser.id,
        createdAt: new Date().toISOString(),
        category: 'event',
        frequency: 'monthly',
        contributionAmount: 50000,
        startDate: new Date().toISOString(),
        votingThreshold: 70,
        privacy: 'private',
        memberRoles: 'equal',
        members: [currentUser.id],
      },
      {
        id: '2',
        name: 'Business Launch',
        description: 'Fund for starting our new tech business',
        targetAmount: 500000,
        currentAmount: 345000,
        creatorId: currentUser.id,
        createdAt: new Date().toISOString(),
        category: 'business',
        frequency: 'weekly',
        contributionAmount: 25000,
        startDate: new Date().toISOString(),
        votingThreshold: 60,
        privacy: 'private',
        memberRoles: 'weighted',
        members: [currentUser.id],
      },
      {
        id: '3',
        name: 'Family Vacation',
        description: 'Saving for our annual family trip',
        targetAmount: 350000,
        currentAmount: 120000,
        creatorId: currentUser.id,
        createdAt: new Date().toISOString(),
        category: 'personal',
        frequency: 'monthly',
        contributionAmount: 30000,
        startDate: new Date().toISOString(),
        votingThreshold: 80,
        privacy: 'private',
        memberRoles: 'equal',
        members: [currentUser.id],
      }
    ];
    
    localStorage.setItem('contributions', JSON.stringify(sampleContributions));
    
    // Create sample transactions
    const sampleTransactions: Transaction[] = sampleContributions.map(contrib => ({
      id: uuidv4(),
      userId: currentUser.id,
      contributionId: contrib.id,
      type: 'deposit',
      amount: contrib.currentAmount,
      status: 'completed',
      description: `Initial deposit for ${contrib.name}`,
      createdAt: new Date().toISOString(),
    }));
    
    localStorage.setItem('transactions', JSON.stringify(sampleTransactions));
  }
};
