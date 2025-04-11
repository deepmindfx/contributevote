
import { v4 as uuidv4 } from "uuid";
import { WithdrawalRequest, localStorageKeys } from "./types";
import { getCurrentUser } from "./userService";

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
export const createWithdrawalRequest = (request: any): WithdrawalRequest => {
  const requests = getWithdrawalRequests();
  const newRequest = {
    id: uuidv4(),
    ...request,
    status: "pending",
    votes: [],
    createdAt: new Date().toISOString()
  };
  
  localStorage.setItem(localStorageKeys.withdrawalRequests, JSON.stringify([...requests, newRequest]));
  return newRequest;
};

/**
 * Function to vote on a withdrawal request
 */
export const voteOnWithdrawalRequest = (requestId: string, vote: 'approve' | 'reject'): WithdrawalRequest | null => {
  const currentUser = getCurrentUser();
  if (!currentUser) return null;
  
  const requests = getWithdrawalRequests();
  const request = requests.find(r => r.id === requestId);
  if (!request) return null;
  
  // Check if user has already voted
  const existingVoteIndex = request.votes.findIndex(v => v.userId === currentUser.id);
  if (existingVoteIndex >= 0) {
    // Update existing vote
    request.votes[existingVoteIndex].vote = vote;
    request.votes[existingVoteIndex].votedAt = new Date().toISOString();
  } else {
    // Add new vote
    request.votes.push({
      userId: currentUser.id,
      vote,
      votedAt: new Date().toISOString()
    });
  }
  
  // Save the updated request
  const updatedRequests = requests.map(r => r.id === requestId ? request : r);
  localStorage.setItem(localStorageKeys.withdrawalRequests, JSON.stringify(updatedRequests));
  
  return request;
};

/**
 * Function to update withdrawal request status
 */
export const updateWithdrawalRequestsStatus = (): void => {
  const requests = getWithdrawalRequests();
  let updated = false;
  
  const updatedRequests = requests.map(request => {
    // Check if a pending request has expired
    if (request.status === "pending" && new Date(request.deadline) < new Date()) {
      updated = true;
      return { ...request, status: "expired" };
    }
    return request;
  });
  
  if (updated) {
    localStorage.setItem(localStorageKeys.withdrawalRequests, JSON.stringify(updatedRequests));
  }
};

/**
 * Function to ping group members for vote
 */
export const pingGroupMembersForVote = (requestId: string): void => {
  // Implementation would go here in a real application
  console.log(`Pinging members for vote on request ${requestId}`);
};
