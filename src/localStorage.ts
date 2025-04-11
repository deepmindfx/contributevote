
// First import any required functions from the original file to fix the errors
import { getCurrentUser, getUsers, User, Contribution } from "@/services/localStorage";
import { isValid } from "date-fns";

// Add the missing function to localStorage.ts
export const verifyUserWithOTP = (userId: string): void => {
  try {
    const users = getUsers();
    const index = users.findIndex(u => u.id === userId);
    
    if (index >= 0) {
      users[index].verified = true;
      localStorage.setItem('users', JSON.stringify(users));
      
      // If this is the current user, update that too
      const currentUser = getCurrentUser();
      if (currentUser && currentUser.id === userId) {
        currentUser.verified = true;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
      }
    }
  } catch (error) {
    console.error("Error in verifyUserWithOTP:", error);
  }
};

// Helper to validate dates
export const validateDate = (dateString: string): boolean => {
  if (!dateString) return false;
  
  try {
    const date = new Date(dateString);
    return isValid(date);
  } catch (error) {
    console.error("Error validating date:", error);
    return false;
  }
};

// Check if a user has contributed to a specific contribution
export const hasContributed = (userId: string, contributionId: string): boolean => {
  try {
    const contribution = getContribution(contributionId);
    if (!contribution) return false;
    
    return contribution.contributors.some(contributor => contributor.userId === userId);
  } catch (error) {
    console.error("Error in hasContributed:", error);
    return false;
  }
};

// Helper function to get a contribution by ID
const getContribution = (contributionId: string): Contribution | null => {
  try {
    const contributionsString = localStorage.getItem('contributions');
    if (!contributionsString) return null;
    
    const contributions: Contribution[] = JSON.parse(contributionsString);
    return contributions.find(c => c.id === contributionId) || null;
  } catch (error) {
    console.error("Error in getContribution:", error);
    return null;
  }
};
