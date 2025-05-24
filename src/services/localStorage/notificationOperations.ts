
import { v4 as uuidv4 } from 'uuid';
import { Notification } from './types';

export const getNotifications = (userId: string): Notification[] => {
  try {
    if (!userId) return [];
    
    const notificationsString = localStorage.getItem('notifications');
    const notifications: Notification[] = notificationsString ? JSON.parse(notificationsString) : [];
    return notifications.filter(notification => notification.userId === userId);
  } catch (error) {
    console.error("Error getting notifications:", error);
    return [];
  }
};

export const addNotification = (notification: Omit<Notification, 'id' | 'createdAt'>) => {
  try {
    if (!notification.userId) {
      console.warn("Attempted to add notification without userId");
      return null;
    }
    
    const notificationsString = localStorage.getItem('notifications');
    const allNotifications: Notification[] = notificationsString ? JSON.parse(notificationsString) : [];
    
    const newNotification: Notification = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      read: false,
      ...notification,
    };
    
    // Add the notification to the general notifications list
    allNotifications.push(newNotification);
    localStorage.setItem('notifications', JSON.stringify(allNotifications));
    
    // Return the notification ID so it can be used for further operations if needed
    return newNotification.id;
  } catch (error) {
    console.error("Error adding notification:", error);
    return null;
  }
};

export const markNotificationAsRead = (id: string) => {
  try {
    if (!id) return;
    
    const notificationsString = localStorage.getItem('notifications');
    if (!notificationsString) return;

    const notifications: Notification[] = JSON.parse(notificationsString);
    const notificationIndex = notifications.findIndex(notification => notification.id === id);
    if (notificationIndex >= 0) {
      notifications[notificationIndex].read = true;
      localStorage.setItem('notifications', JSON.stringify(notifications));
    }
  } catch (error) {
    console.error("Error marking notification as read:", error);
  }
};

export const markAllNotificationsAsRead = (userId: string = null) => {
  try {
    if (!userId) return;
    
    const notificationsString = localStorage.getItem('notifications');
    if (!notificationsString) return;

    const notifications: Notification[] = JSON.parse(notificationsString);
    let updated = false;
    
    notifications.forEach(notification => {
      if ((userId && notification.userId === userId && !notification.read) || 
          (!userId && !notification.read)) {
        notification.read = true;
        updated = true;
      }
    });
    
    if (updated) {
      localStorage.setItem('notifications', JSON.stringify(notifications));
    }
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
  }
};

// Helper function to check if a user has unread notifications
export const hasUnreadNotifications = (userId: string): boolean => {
  if (!userId) return false;
  const notifications = getNotifications(userId);
  return notifications.some(notification => !notification.read);
};

// Helper to get the count of unread notifications
export const getUnreadNotificationsCount = (userId: string): number => {
  if (!userId) return 0;
  const notifications = getNotifications(userId);
  return notifications.filter(notification => !notification.read).length;
};
