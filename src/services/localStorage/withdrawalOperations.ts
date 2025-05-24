
import { v4 as uuidv4 } from 'uuid';
import { WithdrawalRequest } from './types';
import { getBaseContributions, getBaseContributionById } from './storageUtils';
import { addNotification } from './notificationOperations';
import { createTransaction } from './transactionOperations';
import { updateUserBalance } from './utilityOperations';
import { hasContributed } from './utilityOperations';

export const getWithdrawalRequests = (): WithdrawalRequest[] => {
  try {
    const withdrawalRequestsString = localStorage.getItem('withdrawalRequests');
    return withdrawalRequestsString ? JSON.parse(withdrawalRequestsString) : [];
  } catch (error) {
    console.error("Error getting withdrawal requests:", error);
    return [];
  }
};

export const createWithdrawalRequest = (
  request: Omit<WithdrawalRequest, 'id' | 'createdAt' | 'status' | 'votes' | 'deadline'>
): WithdrawalRequest => {
  const withdrawalRequests = getWithdrawalRequests();
  
  // Set deadline to 24 hours from now
  const deadline = new Date();
  deadline.setHours(deadline.getHours() + 24);
  
  const newWithdrawalRequest: WithdrawalRequest = {
    id: uuidv4(),
    status: 'pending',
    votes: [],
    createdAt: new Date().toISOString(),
    deadline: deadline.toISOString(),
    ...request,
  };
  
  withdrawalRequests.push(newWithdrawalRequest);
  localStorage.setItem('withdrawalRequests', JSON.stringify(withdrawalRequests));
  
  // Get the contribution to notify members
  const contribution = getBaseContributionById(request.contributionId);
  if (contribution) {
    // Notify all members of the contribution about this withdrawal request
    contribution.members.forEach(memberId => {
      addNotification({
        id: uuidv4(),
        userId: memberId,
        message: `New withdrawal request of ₦${request.amount.toLocaleString()} from ${contribution.name}`,
        type: 'info',
        read: false,
        relatedId: request.contributionId,
        createdAt: new Date().toISOString(),
      });
    });
  }
  
  return newWithdrawalRequest;
};

export const updateWithdrawalRequest = (
  requestId: string, 
  updates: Partial<WithdrawalRequest>
): WithdrawalRequest | null => {
  const withdrawalRequests = getWithdrawalRequests();
  const index = withdrawalRequests.findIndex(request => request.id === requestId);
  
  if (index < 0) return null;
  
  withdrawalRequests[index] = {
    ...withdrawalRequests[index],
    ...updates,
  };
  
  localStorage.setItem('withdrawalRequests', JSON.stringify(withdrawalRequests));
  return withdrawalRequests[index];
};

export const voteOnWithdrawalRequest = (
  requestId: string,
  voteValue: 'approve' | 'reject'
): void => {
  const withdrawalRequests = getWithdrawalRequests();
  const index = withdrawalRequests.findIndex(request => request.id === requestId);
  
  if (index < 0) {
    throw new Error('Withdrawal request not found');
  }
  
  const request = withdrawalRequests[index];
  
  // Ensure the request is still pending
  if (request.status !== 'pending') {
    throw new Error(`Cannot vote on a ${request.status} request`);
  }
  
  // Get the current user
  const currentUserString = localStorage.getItem('currentUser');
  if (!currentUserString) {
    throw new Error('You must be logged in to vote');
  }
  
  const currentUser = JSON.parse(currentUserString);
  
  // Check if the user has already voted
  const existingVoteIndex = request.votes.findIndex(v => v.userId === currentUser.id);
  if (existingVoteIndex >= 0) {
    throw new Error('You have already voted on this request');
  }
  
  // Get the contribution to check if the user is a member and has contributed
  const contribution = getBaseContributionById(request.contributionId);
  if (!contribution) {
    throw new Error('Contribution not found');
  }
  
  // Check if the user is a member of the contribution
  if (!contribution.members.includes(currentUser.id)) {
    throw new Error('You are not a member of this contribution group');
  }
  
  // Check if the user has contributed to the contribution
  if (!hasContributed(currentUser.id, request.contributionId)) {
    throw new Error('You must contribute to the group before voting');
  }
  
  // Add the vote
  request.votes.push({
    userId: currentUser.id,
    vote: voteValue,
  });
  
  // Check if the request should be approved or rejected based on votes
  // For now, we'll use a simple majority rule with at least 50% participation
  const totalContributors = contribution.contributors.length;
  const totalVotes = request.votes.length;
  const approveVotes = request.votes.filter(v => v.vote === 'approve').length;
  const rejectVotes = request.votes.filter(v => v.vote === 'reject').length;
  
  // Require at least 50% of contributors to vote (modified from 50% of members)
  const minVotesRequired = Math.ceil(totalContributors * 0.5);
  
  // If we have enough votes, check the outcome
  if (totalVotes >= minVotesRequired) {
    if (approveVotes > rejectVotes) {
      // Approved - update status and process the withdrawal
      request.status = 'approved';
      processApprovedWithdrawal(request);
    } 
    else if (rejectVotes >= approveVotes) {
      // Rejected - update status
      request.status = 'rejected';
    }
  }
  
  // Save the updated request
  withdrawalRequests[index] = request;
  localStorage.setItem('withdrawalRequests', JSON.stringify(withdrawalRequests));
  
  // Create a transaction record for this vote
  createTransaction({
    userId: currentUser.id,
    type: 'vote',
    amount: 0,
    contributionId: request.contributionId,
    description: `Voted ${voteValue} on withdrawal request`,
    status: 'completed',
  });
  
  // Notify the contribution creator about the vote
  addNotification({
    id: uuidv4(),
    userId: contribution.creatorId,
    message: `${currentUser.name} voted to ${voteValue} your withdrawal request`,
    type: 'info',
    read: false,
    relatedId: request.contributionId,
    createdAt: new Date().toISOString(),
  });
};

const processApprovedWithdrawal = (request: WithdrawalRequest): void => {
  // Get the contribution
  const contribution = getBaseContributionById(request.contributionId);
  if (!contribution) return;
  
  // Update the contribution amount
  const contributions = getBaseContributions();
  const contributionIndex = contributions.findIndex(c => c.id === request.contributionId);
  
  if (contributionIndex >= 0) {
    contributions[contributionIndex].currentAmount -= request.amount;
    localStorage.setItem('contributions', JSON.stringify(contributions));
  }
  
  // Get the user who created the withdrawal request
  const usersString = localStorage.getItem('users');
  if (!usersString) return;
  
  const users = JSON.parse(usersString);
  const userIndex = users.findIndex((u: any) => u.id === contribution.creatorId);
  
  if (userIndex >= 0) {
    // Create a transaction record
    createTransaction({
      userId: contribution.creatorId,
      type: 'withdrawal',
      amount: request.amount,
      contributionId: request.contributionId,
      description: `Withdrawal from ${contribution.name}`,
      status: 'completed',
    });
    
    // Update user balance
    updateUserBalance(contribution.creatorId, users[userIndex].walletBalance + request.amount);
    
    // Notify the user
    addNotification({
      id: uuidv4(),
      userId: contribution.creatorId,
      message: `Your withdrawal request for ₦${request.amount.toLocaleString()} has been approved`,
      type: 'success',
      read: false,
      relatedId: request.contributionId,
      createdAt: new Date().toISOString(),
    });
  }
};

export const pingGroupMembersForVote = (requestId: string): void => {
  const withdrawalRequests = getWithdrawalRequests();
  const request = withdrawalRequests.find(r => r.id === requestId);
  
  if (!request) {
    throw new Error('Withdrawal request not found');
  }
  
  if (request.status !== 'pending') {
    throw new Error(`Cannot ping members for a ${request.status} request`);
  }
  
  // Get the contribution
  const contribution = getBaseContributionById(request.contributionId);
  if (!contribution) {
    throw new Error('Contribution not found');
  }
  
  // Get current user
  const currentUserString = localStorage.getItem('currentUser');
  if (!currentUserString) {
    throw new Error('You must be logged in to ping members');
  }
  
  const currentUser = JSON.parse(currentUserString);
  
  // Check if the current user is the creator of the contribution
  if (contribution.creatorId !== currentUser.id) {
    throw new Error('Only the group creator can ping members for votes');
  }
  
  // Get the users who haven't voted yet
  const votedUserIds = request.votes.map(vote => vote.userId);
  const nonVotedMembers = contribution.members.filter(
    memberId => !votedUserIds.includes(memberId) && memberId !== currentUser.id
  );
  
  // Send notifications to non-voted members
  nonVotedMembers.forEach(memberId => {
    addNotification({
      id: uuidv4(),
      userId: memberId,
      message: `REMINDER: Please vote on the withdrawal request for ${contribution.name}`,
      type: 'warning',
      read: false,
      relatedId: request.contributionId,
      createdAt: new Date().toISOString(),
    });
  });
};

export const updateWithdrawalRequestsStatus = (): void => {
  const withdrawalRequests = getWithdrawalRequests();
  let updated = false;
  
  withdrawalRequests.forEach(request => {
    // Skip if not pending
    if (request.status !== 'pending') return;
    
    // Check if deadline has passed
    const deadline = new Date(request.deadline);
    const now = new Date();
    
    if (now > deadline) {
      request.status = 'expired';
      updated = true;
      
      // Notify the creator
      const contribution = getBaseContributionById(request.contributionId);
      if (contribution) {
        addNotification({
          id: uuidv4(),
          userId: contribution.creatorId,
          message: `Your withdrawal request for ${contribution.name} has expired due to insufficient votes`,
          type: 'warning',
          read: false,
          relatedId: request.contributionId,
          createdAt: new Date().toISOString(),
        });
      }
    }
  });
  
  if (updated) {
    localStorage.setItem('withdrawalRequests', JSON.stringify(withdrawalRequests));
  }
};
