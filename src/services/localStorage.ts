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

// Add the missing functions needed by admin dashboard
export const createUser = (userData: any): void => {
  try {
    const users = getUsers();
    users.push(userData);
    localStorage.setItem('users', JSON.stringify(users));
  } catch (error) {
    console.error("Error creating user:", error);
  }
};

export const deleteUser = (userId: string): void => {
  try {
    const users = getUsers();
    const updatedUsers = users.filter((user: any) => user.id !== userId);
    localStorage.setItem('users', JSON.stringify(updatedUsers));
  } catch (error) {
    console.error("Error deleting user:", error);
  }
};

export const updateUserRole = (userId: string, role: string): void => {
  try {
    const users = getUsers();
    const userIndex = users.findIndex((user: any) => user.id === userId);
    
    if (userIndex >= 0) {
      users[userIndex].role = role;
      localStorage.setItem('users', JSON.stringify(users));
      
      // If this is the current user, update that too
      const currentUser = getCurrentUser();
      if (currentUser && currentUser.id === userId) {
        currentUser.role = role;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
      }
    }
  } catch (error) {
    console.error("Error updating user role:", error);
  }
};
