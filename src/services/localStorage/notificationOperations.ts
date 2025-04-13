
import { v4 as uuidv4 } from 'uuid';
import { Notification } from './types';

export const getNotifications = (userId: string): Notification[] => {
  const notificationsString = localStorage.getItem('notifications');
  const notifications: Notification[] = notificationsString ? JSON.parse(notificationsString) : [];
  return notifications.filter(notification => notification.userId === userId);
};

export const addNotification = (notification: Omit<Notification, 'id' | 'createdAt'>) => {
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
};

export const markNotificationAsRead = (id: string) => {
  const notificationsString = localStorage.getItem('notifications');
  if (!notificationsString) return;

  const notifications: Notification[] = JSON.parse(notificationsString);
  const notificationIndex = notifications.findIndex(notification => notification.id === id);
  if (notificationIndex >= 0) {
    notifications[notificationIndex].read = true;
    localStorage.setItem('notifications', JSON.stringify(notifications));
  }
};

export const markAllNotificationsAsRead = (userId: string = null) => {
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
};

// Helper function to check if a user has unread notifications
export const hasUnreadNotifications = (userId: string): boolean => {
  const notifications = getNotifications(userId);
  return notifications.some(notification => !notification.read);
};

// Helper to get the count of unread notifications
export const getUnreadNotificationsCount = (userId: string): number => {
  const notifications = getNotifications(userId);
  return notifications.filter(notification => !notification.read).length;
};
