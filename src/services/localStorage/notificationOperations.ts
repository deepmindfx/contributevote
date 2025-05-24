import { Notification } from './types';
import { getBaseCurrentUser } from './storageUtils';

export const getNotifications = (userId: string): Notification[] => {
  try {
    const currentUser = getBaseCurrentUser();
    if (!currentUser || currentUser.id !== userId) return [];
    
    return currentUser.notifications || [];
  } catch (error) {
    console.error("Error getting notifications:", error);
    return [];
  }
};

export const addNotification = (notification: Notification): void => {
  try {
    const currentUser = getBaseCurrentUser();
    if (!currentUser) return;
    
    if (!currentUser.notifications) {
      currentUser.notifications = [];
    }
    
    currentUser.notifications.unshift(notification);
    
    // Keep only last 50 notifications
    if (currentUser.notifications.length > 50) {
      currentUser.notifications = currentUser.notifications.slice(0, 50);
    }
    
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // Also update in users array
    const usersString = localStorage.getItem('users');
    if (usersString) {
      const users = JSON.parse(usersString);
      const userIndex = users.findIndex((u: any) => u.id === currentUser.id);
      if (userIndex >= 0) {
        users[userIndex] = currentUser;
        localStorage.setItem('users', JSON.stringify(users));
      }
    }
  } catch (error) {
    console.error("Error adding notification:", error);
  }
};

export const createNotification = (notification: Notification): void => {
  addNotification(notification);
};

export const markNotificationAsRead = (notificationId: string): void => {
  try {
    const currentUser = getBaseCurrentUser();
    if (!currentUser || !currentUser.notifications) return;
    
    const notificationIndex = currentUser.notifications.findIndex(n => n.id === notificationId);
    if (notificationIndex >= 0) {
      currentUser.notifications[notificationIndex].read = true;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      
      // Also update in users array
      const usersString = localStorage.getItem('users');
      if (usersString) {
        const users = JSON.parse(usersString);
        const userIndex = users.findIndex((u: any) => u.id === currentUser.id);
        if (userIndex >= 0) {
          users[userIndex] = currentUser;
          localStorage.setItem('users', JSON.stringify(users));
        }
      }
    }
  } catch (error) {
    console.error("Error marking notification as read:", error);
  }
};

export const markAllNotificationsAsRead = (): void => {
  try {
    const currentUser = getBaseCurrentUser();
    if (!currentUser || !currentUser.notifications) return;
    
    currentUser.notifications = currentUser.notifications.map(notification => ({
      ...notification,
      read: true
    }));
    
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // Also update in users array
    const usersString = localStorage.getItem('users');
    if (usersString) {
      const users = JSON.parse(usersString);
      const userIndex = users.findIndex((u: any) => u.id === currentUser.id);
      if (userIndex >= 0) {
        users[userIndex] = currentUser;
        localStorage.setItem('users', JSON.stringify(users));
      }
    }
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
  }
};
