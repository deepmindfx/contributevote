
import { toast } from 'sonner';

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

// Add more contribution-related functions as needed
