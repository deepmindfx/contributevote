
// First import any required functions from the original file to fix the errors
import { getCurrentUser, getUsers } from "@/services/localStorage";
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

// Add a function to check if user has a BVN
export const hasRequiredDetailsForGroupAccount = (userId: string): boolean => {
  try {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    
    // Check if user exists and has BVN
    return !!(user && user.bvn && user.bvn.length > 0);
  } catch (error) {
    console.error("Error checking user BVN:", error);
    return false;
  }
};
