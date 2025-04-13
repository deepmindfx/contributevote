
import { toast } from 'sonner';
import { Contribution, WithdrawalRequest } from '@/types';

// Helper function to get contributions from localStorage
const getContributions = () => {
  try {
    const contributions = localStorage.getItem('contributions');
    return contributions ? JSON.parse(contributions) : [];
  } catch (error) {
    console.error("Error getting contributions:", error);
    return [];
  }
};

// Helper function to save contributions to localStorage
const saveContributions = (contributions: any[]) => {
  try {
    localStorage.setItem('contributions', JSON.stringify(contributions));
  } catch (error) {
    console.error("Error saving contributions:", error);
    toast.error("Failed to save changes. Please try again.");
  }
};

// Get contribution details by ID
export const getContributionDetails = (contributionId: string): Contribution | null => {
  try {
    const contributions = getContributions();
    return contributions.find((contribution: Contribution) => contribution.id === contributionId) || null;
  } catch (error) {
    console.error("Error getting contribution details:", error);
    return null;
  }
};

// Delete a contribution by ID
export const deleteContribution = async (contributionId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // Get all contributions
      const contributions = getContributions();
      
      // Filter out the contribution to delete
      const updatedContributions = contributions.filter(
        (contribution: any) => contribution.id !== contributionId
      );
      
      // Save the updated list
      saveContributions(updatedContributions);
      
      // Update any other related data in localStorage if needed
      // For example, you might want to update user's contributions list
      
      resolve();
    } catch (error) {
      console.error("Error deleting contribution:", error);
      reject(error);
    }
  });
};

// Get all withdrawal requests
export const getWithdrawalRequests = (): WithdrawalRequest[] => {
  try {
    const requests = localStorage.getItem('withdrawalRequests');
    return requests ? JSON.parse(requests) : [];
  } catch (error) {
    console.error("Error getting withdrawal requests:", error);
    return [];
  }
};

// Submit vote on a withdrawal request
export const submitVote = (requestId: string, vote: 'approve' | 'reject'): void => {
  try {
    const requests = getWithdrawalRequests();
    const requestIndex = requests.findIndex(r => r.id === requestId);
    
    if (requestIndex === -1) {
      toast.error("Withdrawal request not found");
      return;
    }
    
    // Here you would add the user's vote
    // This is a simplified version, in a real implementation you would:
    // 1. Check if the user has already voted
    // 2. Add the vote with userId, vote type, and timestamp
    // 3. Check if the vote threshold has been reached to approve/reject
    
    toast.success(`Your vote to ${vote} has been submitted`);
    
    // Save the updated requests
    localStorage.setItem('withdrawalRequests', JSON.stringify(requests));
  } catch (error) {
    console.error("Error submitting vote:", error);
    toast.error("Failed to submit vote. Please try again.");
  }
};

// Create a withdrawal request
export const createWithdrawalRequest = (request: any): void => {
  try {
    const requests = getWithdrawalRequests();
    requests.push({
      ...request,
      id: `req-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'pending',
      votes: []
    });
    
    localStorage.setItem('withdrawalRequests', JSON.stringify(requests));
    toast.success("Withdrawal request created successfully");
  } catch (error) {
    console.error("Error creating withdrawal request:", error);
    toast.error("Failed to create withdrawal request. Please try again.");
  }
};
