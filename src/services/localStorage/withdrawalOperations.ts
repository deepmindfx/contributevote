
import { v4 as uuidv4 } from 'uuid';
import { WithdrawalRequest } from './types';
import { getBaseCurrentUser, getBaseContributionById } from './storageUtils';
import { addNotification } from './notificationOperations';
import { updateContribution } from './contributionOperations';
import { createTransaction } from './transactionOperations';
import { hasContributed } from './utilityOperations';

export const getWithdrawalRequests = (): WithdrawalRequest[] => {
  try {
    const requestsString = localStorage.getItem('withdrawalRequests');
    return requestsString ? JSON.parse(requestsString) : [];
  } catch (error) {
    console.error("Error getting withdrawal requests:", error);
    return [];
  }
};

export const createWithdrawalRequest = (request: Omit<WithdrawalRequest, 'id' | 'createdAt' | 'status' | 'votes' | 'deadline'>) => {
  const withdrawalRequests = getWithdrawalRequests();
  const contribution = getBaseContributionById(request.contributionId);
  
  if (!contribution) throw new Error('Contribution not found');
  
  // Set the deadline to 3 days from now
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 3);
  
  const newRequest: WithdrawalRequest = {
    id: uuidv4(),
    status: 'pending',
    votes: [],
    createdAt: new Date().toISOString(),
    deadline: deadline.toISOString(),
    ...request,
  };
  
  withdrawalRequests.push(newRequest);
  localStorage.setItem('withdrawalRequests', JSON.stringify(withdrawalRequests));
  
  // Notify all members of the contribution about the withdrawal request
  contribution.members.forEach(memberId => {
    // Don't notify the creator who just created the request
    if (memberId !== contribution.creatorId) {
      addNotification({
        userId: memberId,
        message: `New withdrawal request for ${contribution.name}: ₦${request.amount.toLocaleString()} needs your vote`,
        type: 'info',
        read: false,
        relatedId: contribution.id,
      });
    }
  });
  
  return newRequest;
};

export const updateWithdrawalRequest = (id: string, data: Partial<WithdrawalRequest>) => {
  const withdrawalRequests = getWithdrawalRequests();
  const requestIndex = withdrawalRequests.findIndex(request => request.id === id);
  
  if (requestIndex >= 0) {
    withdrawalRequests[requestIndex] = { ...withdrawalRequests[requestIndex], ...data };
    localStorage.setItem('withdrawalRequests', JSON.stringify(withdrawalRequests));
  }
};

export const voteOnWithdrawalRequest = (requestId: string, vote: 'approve' | 'reject') => {
  const user = getBaseCurrentUser();
  if (!user) throw new Error('User not logged in');
  
  const withdrawalRequests = getWithdrawalRequests();
  const request = withdrawalRequests.find(req => req.id === requestId);
  
  if (!request) throw new Error('Withdrawal request not found');
  if (request.status !== 'pending') throw new Error('This request is no longer pending');
  
  // Check if this is still valid (not past deadline)
  const deadline = new Date(request.deadline);
  if (deadline < new Date()) throw new Error('Voting deadline has passed');
  
  // Check if user has already voted
  if (request.votes.some(v => v.userId === user.id)) {
    throw new Error('You have already voted on this request');
  }
  
  // Check if user has contributed to this contribution
  const contribution = getBaseContributionById(request.contributionId);
  if (!contribution) throw new Error('Contribution not found');
  
  // Only allow voting if user is a member of the contribution and has contributed
  if (!contribution.members.includes(user.id)) {
    throw new Error('You are not a member of this contribution group');
  }
  
  if (!hasContributed(user.id, contribution.id)) {
    throw new Error('Only contributors can vote on withdrawal requests');
  }
  
  // Add vote
  request.votes.push({
    userId: user.id,
    vote,
  });
  
  // Check if voting threshold has been reached
  const totalVotes = request.votes.length;
  const approvalVotes = request.votes.filter(v => v.vote === 'approve').length;
  const rejectionVotes = request.votes.filter(v => v.vote === 'reject').length;
  
  // Set a threshold (can be based on percentage or absolute number)
  const votingThreshold = contribution.votingThreshold || 0.5; // Default to 50% if not set
  const totalMembers = contribution.members.length;
  
  let newStatus = request.status;
  
  if (approvalVotes / totalMembers >= votingThreshold) {
    newStatus = 'approved';
    
    // Process the withdrawal
    if (contribution.currentAmount >= request.amount) {
      // Update the contribution amount
      updateContribution(contribution.id, {
        currentAmount: contribution.currentAmount - request.amount,
      });
      
      // Create a transaction record
      createTransaction({
        contributionId: contribution.id,
        userId: request.beneficiary,
        type: 'withdrawal',
        amount: request.amount,
        description: request.reason || `Withdrawal from ${contribution.name}`,
      });
      
      // Notify members about approval
      contribution.members.forEach(memberId => {
        addNotification({
          userId: memberId,
          message: `Withdrawal request of ₦${request.amount.toLocaleString()} from ${contribution.name} has been approved`,
          type: 'success',
          read: false,
          relatedId: contribution.id,
        });
      });
    }
  } else if (rejectionVotes / totalMembers > (1 - votingThreshold)) {
    newStatus = 'rejected';
    
    // Notify members about rejection
    contribution.members.forEach(memberId => {
      addNotification({
        userId: memberId,
        message: `Withdrawal request of ₦${request.amount.toLocaleString()} from ${contribution.name} has been rejected`,
        type: 'error',
        read: false,
        relatedId: contribution.id,
      });
    });
  }
  
  // Update the request status
  if (newStatus !== request.status) {
    request.status = newStatus;
  }
  
  // Save the updated request
  updateWithdrawalRequest(requestId, request);
  
  return request;
};

export const updateWithdrawalRequestsStatus = () => {
  const now = new Date();
  const withdrawalRequests = getWithdrawalRequests();
  let updated = false;
  
  withdrawalRequests.forEach(request => {
    if (request.status === 'pending') {
      const deadline = new Date(request.deadline);
      
      if (deadline < now) {
        request.status = 'expired';
        updated = true;
        
        // Notify the creator that the request expired
        const contribution = getBaseContributionById(request.contributionId);
        if (contribution) {
          addNotification({
            userId: contribution.creatorId,
            message: `Your withdrawal request of ₦${request.amount.toLocaleString()} from ${contribution.name} has expired due to insufficient votes`,
            type: 'error',
            read: false,
            relatedId: contribution.id,
          });
        }
      }
    }
  });
  
  if (updated) {
    localStorage.setItem('withdrawalRequests', JSON.stringify(withdrawalRequests));
  }
};

export const pingGroupMembersForVote = (requestId: string) => {
  const user = getBaseCurrentUser();
  if (!user) throw new Error('User not logged in');
  
  const withdrawalRequests = getWithdrawalRequests();
  const request = withdrawalRequests.find(req => req.id === requestId);
  
  if (!request) throw new Error('Withdrawal request not found');
  if (request.status !== 'pending') throw new Error('This request is no longer pending');
  
  const contribution = getBaseContributionById(request.contributionId);
  if (!contribution) throw new Error('Contribution not found');
  
  // Check if user is creator of the contribution
  if (contribution.creatorId !== user.id) {
    throw new Error('Only the group creator can send vote reminders');
  }
  
  // Find members who haven't voted yet
  const nonVoters = contribution.members.filter(
    memberId => !request.votes.some(vote => vote.userId === memberId)
  );
  
  // Send notifications to non-voters
  nonVoters.forEach(memberId => {
    addNotification({
      userId: memberId,
      message: `Reminder: Your vote is needed for a withdrawal request of ₦${request.amount.toLocaleString()} from ${contribution.name}`,
      type: 'warning',
      read: false,
      relatedId: contribution.id,
    });
  });
  
  return nonVoters.length;
};
