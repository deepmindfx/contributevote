
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { WithdrawalRequest } from './types';
import { getBaseCurrentUser } from './storageUtils';
import { getContributionById } from './contributionOperations';
import { hasContributed } from './utilityOperations';
import { createTransaction } from './transactionOperations';
import { addNotification } from './notificationOperations';

export const getWithdrawalRequests = (): WithdrawalRequest[] => {
  const withdrawalRequestsString = localStorage.getItem('withdrawalRequests');
  return withdrawalRequestsString ? JSON.parse(withdrawalRequestsString) : [];
};

export const createWithdrawalRequest = (request: Omit<WithdrawalRequest, 'id' | 'createdAt' | 'status' | 'votes' | 'deadline'>) => {
  const user = getBaseCurrentUser();
  if (!user) throw new Error('User not logged in');

  const contribution = getContributionById(request.contributionId);
   if (!contribution) throw new Error('Contribution group not found');
  
  if (contribution.creatorId !== user.id) throw new Error('Only the group creator can request withdrawals');

  const withdrawalRequests = getWithdrawalRequests();
  const newWithdrawalRequest: WithdrawalRequest = {
    id: uuidv4(),
    status: 'pending',
    votes: [],
    createdAt: new Date().toISOString(),
    deadline: format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd HH:mm'), // 24 hours from now
    ...request,
  };
  withdrawalRequests.push(newWithdrawalRequest);
  localStorage.setItem('withdrawalRequests', JSON.stringify(withdrawalRequests));
  
  // Create a transaction record
  createTransaction({
    contributionId: request.contributionId,
    userId: user.id,
    type: 'withdrawal',
    amount: request.amount,
    description: `Withdrawal request for ${request.purpose}`,
    status: 'pending',
  });
};

export const updateWithdrawalRequest = (id: string, requestData: Partial<WithdrawalRequest>) => {
  const withdrawalRequests = getWithdrawalRequests();
  const requestIndex = withdrawalRequests.findIndex(request => request.id === id);
  if (requestIndex >= 0) {
    withdrawalRequests[requestIndex] = { ...withdrawalRequests[requestIndex], ...requestData };
    localStorage.setItem('withdrawalRequests', JSON.stringify(withdrawalRequests));
  }
};

export const voteOnWithdrawalRequest = (requestId: string, voteValue: 'approve' | 'reject') => {
  const user = getCurrentUser();
  if (!user) throw new Error('User not logged in');

  const withdrawalRequests = getWithdrawalRequests();
  const requestIndex = withdrawalRequests.findIndex(request => request.id === requestId);

  if (requestIndex < 0) {
    throw new Error('Withdrawal request not found');
  }

  const request = withdrawalRequests[requestIndex];
  const contribution = getContributionById(request.contributionId);

  if (!contribution) {
    throw new Error('Contribution group not found');
  }

  // Check if the user is a member of the contribution group
  if (!contribution.members.includes(user.id)) {
    throw new Error('You are not a member of this contribution group');
  }

  // Check if the user has contributed to the group
  if (!hasContributed(user.id, contribution.id)) {
    throw new Error('You must contribute to this group before voting');
  }

  // Check if the user has already voted
  const existingVote = request.votes.find(vote => vote.userId === user.id);
  if (existingVote) {
    throw new Error('You have already voted on this request');
  }

  // Add the vote
  request.votes.push({ userId: user.id, vote: voteValue });
  withdrawalRequests[requestIndex] = request;
  localStorage.setItem('withdrawalRequests', JSON.stringify(withdrawalRequests));
};

export const pingGroupMembersForVote = (requestId: string) => {
  const withdrawalRequests = getWithdrawalRequests();
  const requestIndex = withdrawalRequests.findIndex(request => request.id === requestId);
  
  if (requestIndex < 0) {
    throw new Error('Withdrawal request not found');
  }
  
  const request = withdrawalRequests[requestIndex];
  const contribution = getContributionById(request.contributionId);
  
  if (!contribution) {
    throw new Error('Contribution group not found');
  }
  
  // Get IDs of members who have not voted
  const nonVoters = contribution.members.filter(memberId => {
    return !request.votes.some(vote => vote.userId === memberId) && hasContributed(memberId, contribution.id);
  });
  
  if (nonVoters.length === 0) {
    throw new Error('All members have already voted');
  }
  
  // In a real app, we would send notifications to these members
  nonVoters.forEach(memberId => {
    const member = getCurrentUser();
    if (member) {
      addNotification({
        userId: memberId,
        message: `Reminder: Vote on the withdrawal request for "${contribution.name}"`,
        type: 'info',
        read: false,
        relatedId: requestId,
      });
      console.log(`Sending reminder to ${member.name} to vote on request ${requestId}`);
    }
  });
};

export const updateWithdrawalRequestsStatus = () => {
  const withdrawalRequests = getWithdrawalRequests();
  let updated = false;
  
  withdrawalRequests.forEach(request => {
    if (request.status === 'pending' && request.deadline) {
      const deadlineDate = new Date(request.deadline);
      const now = new Date();
      
      if (deadlineDate < now) {
        request.status = 'expired';
        updated = true;
      } else {
        // Count the number of approvals and rejections
        const approvals = request.votes.filter(vote => vote.vote === 'approve').length;
        const rejections = request.votes.filter(vote => vote.vote === 'reject').length;
        
        // Calculate the number of members who have contributed
        const totalContributors = getContributionById(request.contributionId)?.members.filter(memberId => hasContributed(memberId, request.contributionId)).length || 0;
        
        // Determine if 51% of contributors have approved the request
        const approvalThreshold = totalContributors * 0.51;
        
        if (approvals >= approvalThreshold) {
          request.status = 'approved';
          updated = true;
        } else if (rejections > (totalContributors - approvalThreshold)) {
          request.status = 'rejected';
          updated = true;
        }
      }
    }
  });
  
  if (updated) {
    localStorage.setItem('withdrawalRequests', JSON.stringify(withdrawalRequests));
  }
};
