
// Import the functions from the correct source
import { 
  getCurrentUser, 
  getUsers,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  hasContributed
} from "@/services/localStorage";

// Export them again to maintain compatibility
export {
  getCurrentUser,
  getUsers,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  hasContributed
};

// Add the missing function to localStorage.ts
export const verifyUserWithOTP = (userId: string): void => {
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
};
