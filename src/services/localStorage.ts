// Fix the markNotificationAsRead function to accept only one parameter
export const markNotificationAsRead = (notificationId: string) => {
  try {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) return;
    
    const user = JSON.parse(storedUser);
    if (!user.notifications) return;
    
    const updatedNotifications = user.notifications.map((notification: any) =>
      notification.id === notificationId 
        ? { ...notification, read: true, isRead: true } 
        : notification
    );
    
    user.notifications = updatedNotifications;
    localStorage.setItem('currentUser', JSON.stringify(user));
    
    // Update in users array as well
    const storedUsers = localStorage.getItem('users');
    if (storedUsers) {
      const users = JSON.parse(storedUsers);
      const updatedUsers = users.map((u: any) =>
        u.id === user.id ? user : u
      );
      localStorage.setItem('users', JSON.stringify(updatedUsers));
    }
  } catch (error) {
    console.error("Error marking notification as read:", error);
  }
};

// Fix the markAllNotificationsAsRead function
export const markAllNotificationsAsRead = () => {
  try {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) return;
    
    const user = JSON.parse(storedUser);
    if (!user.notifications) return;
    
    const updatedNotifications = user.notifications.map((notification: any) => ({
      ...notification,
      read: true,
      isRead: true
    }));
    
    user.notifications = updatedNotifications;
    localStorage.setItem('currentUser', JSON.stringify(user));
    
    // Update in users array as well
    const storedUsers = localStorage.getItem('users');
    if (storedUsers) {
      const users = JSON.parse(storedUsers);
      const updatedUsers = users.map((u: any) =>
        u.id === user.id ? user : u
      );
      localStorage.setItem('users', JSON.stringify(updatedUsers));
    }
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
  }
};

// Update getCurrentUser to ensure it handles empty states
export const getCurrentUser = () => {
  try {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) return null;
    
    const user = JSON.parse(storedUser);
    
    // Ensure user has the required properties
    if (!user.notifications) user.notifications = [];
    if (!user.walletBalance) user.walletBalance = 0;
    if (!user.preferences) user.preferences = {
      anonymousContributions: false,
      darkMode: false
    };
    
    return user;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
};

export const getUsers = () => {
  try {
    const storedUsers = localStorage.getItem('users');
    return storedUsers ? JSON.parse(storedUsers) : [];
  } catch (error) {
    console.error("Error getting users:", error);
    return [];
  }
};

// Add the hasContributed function needed by Votes.tsx
export const hasContributed = (userId: string, contributionId: string): boolean => {
  try {
    const storedContributions = localStorage.getItem('contributions');
    if (!storedContributions) return false;
    
    const contributions = JSON.parse(storedContributions);
    const contribution = contributions.find((c: any) => c.id === contributionId);
    
    if (!contribution || !contribution.contributions) return false;
    
    return contribution.contributions.some((c: any) => c.userId === userId);
  } catch (error) {
    console.error("Error checking if user has contributed:", error);
    return false;
  }
};

// Add User type for admin Dashboard
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  verified?: boolean;
  notifications?: any[];
  [key: string]: any;
}
