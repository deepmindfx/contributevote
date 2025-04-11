
import { v4 as uuidv4 } from "uuid";
import { localStorageKeys, WithdrawalRequest } from "./types";
import { getCurrentUser } from "./userService";
import { getContributionById } from "./contributionService";
import { hasContributed } from "./transactionService";
import { addNotification } from "./userService";

/**
 * Function to get all withdrawal requests
 */
export const getWithdrawalRequests = (): WithdrawalRequest[] => {
  const requestsString = localStorage.getItem(localStorageKeys.withdrawalRequests);
  if (!requestsString) return [];
  return JSON.parse(requestsString);
};

/**
 * Function to create a withdrawal request
 */
export const createWithdrawalRequest = (requestData: any): WithdrawalRequest => {
  const requests = getWithdrawalRequests();
  
  // Set deadline to 3 days from now
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 3);
  
  const newRequest: WithdrawalRequest = {
    id: uuidv4(),
    ...requestData,
    status: 'pending',
    votes: [],
    createdAt: new Date().toISOString(),
    deadline: deadline.toISOString()
  };
  
  localStorage.setItem(localStorageKeys.withdrawalRequests, JSON.stringify([...requests, newRequest]));
  return newRequest;
};

/**
 * Function to vote on a withdrawal request
 */
export const voteOnWithdrawalRequest = (requestId: string, vote: 'approve' | 'reject'): void => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error("You must be logged in to vote");
  }
  
  const requests = getWithdrawalRequests();
  const requestIndex = requests.findIndex(r => r.id === requestId);
  
  if (requestIndex < 0) {
    throw new Error("Withdrawal request not found");
  }
  
  const request = requests[requestIndex];
  
  // Check if request is still pending
  if (request.status !== 'pending') {
    throw new Error(`Cannot vote on a ${request.status} request`);
  }
  
  // Check if deadline has passed
  if (new Date(request.deadline) < new Date()) {
    throw new Error("Voting deadline has passed");
  }
  
  // Check if user has already voted
  if (request.votes.some(v => v.userId === currentUser.id)) {
    throw new Error("You have already voted on this request");
  }
  
  // Check if user has contributed to this group
  const contribution = getContributionById(request.contributionId);
  if (!contribution) {
    throw new Error("Contribution group not found");
  }
  
  if (!hasContributed(currentUser.id, request.contributionId) && currentUser.id !== contribution.creatorId) {
    throw new Error("Only contributors can vote on withdrawal requests");
  }
  
  // Add the vote
  request.votes.push({
    userId: currentUser.id,
    vote,
    votedAt: new Date().toISOString()
  });
  
  // Check if we have enough votes to approve or reject
  if (contribution.votingThreshold && contribution.members?.length) {
    const thresholdCount = Math.ceil(contribution.members.length * (contribution.votingThreshold / 100));
    const approveVotes = request.votes.filter(v => v.vote === 'approve').length;
    const rejectVotes = request.votes.filter(v => v.vote === 'reject').length;
    
    if (approveVotes >= thresholdCount) {
      request.status = 'approved';
      
      // Notify the creator
      addNotification({
        userId: request.creatorId,
        message: `Your withdrawal request for ${contribution.name} has been approved`,
        type: 'success',
        relatedId: request.id
      });
    } else if (rejectVotes >= thresholdCount) {
      request.status = 'rejected';
      
      // Notify the creator
      addNotification({
        userId: request.creatorId,
        message: `Your withdrawal request for ${contribution.name} has been rejected`,
        type: 'error',
        relatedId: request.id
      });
    }
  }
  
  // Update the requests in localStorage
  localStorage.setItem(localStorageKeys.withdrawalRequests, JSON.stringify(requests));
};

/**
 * Function to update withdrawal requests status
 */
export const updateWithdrawalRequestsStatus = (): void => {
  const requests = getWithdrawalRequests();
  const now = new Date();
  let updated = false;
  
  const updatedRequests = requests.map(request => {
    if (request.status === 'pending' && new Date(request.deadline) < now) {
      updated = true;
      
      // Notify the creator
      const contribution = getContributionById(request.contributionId);
      if (contribution) {
        addNotification({
          userId: request.creatorId,
          message: `Your withdrawal request for ${contribution.name} has expired`,
          type: 'warning',
          relatedId: request.id
        });
      }
      
      return {
        ...request,
        status: 'expired'
      };
    }
    return request;
  });
  
  if (updated) {
    localStorage.setItem(localStorageKeys.withdrawalRequests, JSON.stringify(updatedRequests));
  }
};

/**
 * Function to ping group members for a vote
 */
export const pingGroupMembersForVote = (requestId: string): void => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error("You must be logged in to ping group members");
  }
  
  const requests = getWithdrawalRequests();
  const request = requests.find(r => r.id === requestId);
  
  if (!request) {
    throw new Error("Withdrawal request not found");
  }
  
  // Check if the current user is the creator of the request
  if (request.creatorId !== currentUser.id) {
    throw new Error("Only the request creator can ping group members");
  }
  
  const contribution = getContributionById(request.contributionId);
  if (!contribution || !contribution.members) {
    throw new Error("Contribution group not found");
  }
  
  // Get members who haven't voted yet
  const votedUserIds = request.votes.map(v => v.userId);
  const notVotedMembers = contribution.members.filter(memberId => !votedUserIds.includes(memberId));
  
  // Send notifications to members who haven't voted
  notVotedMembers.forEach(memberId => {
    addNotification({
      userId: memberId,
      message: `Reminder: Please vote on the withdrawal request for ${contribution.name}`,
      type: 'info',
      relatedId: request.id
    });
  });
};
