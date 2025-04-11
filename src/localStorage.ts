
// First import any required functions from the original file to fix the errors
import { getCurrentUser, getUsers } from "@/services/localStorage";

// Add the missing function to localStorage.ts
export const verifyUserWithOTP = (userId: string): void => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === userId);
  
  if (index >= 0) {
    users[index].verified = true;
    localStorage.setItem('users', JSON.stringify(users));
    
    // If this is the current user, update that too
    const currentUser = getCurrentUser();
    if (currentUser.id === userId) {
      currentUser.verified = true;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    }
  }
};
