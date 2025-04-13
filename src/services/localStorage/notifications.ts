
import { v4 as uuidv4 } from 'uuid';
import { Notification } from './types';

export const getNotifications = (userId: string): Notification[] => {
  const notificationsString = localStorage.getItem('notifications');
  const notifications: Notification[] = notificationsString ? JSON.parse(notificationsString) : [];
  return notifications.filter(notification => notification.userId === userId);
};

export const addNotification = (notification: Omit<Notification, 'id' | 'createdAt'>) => {
  const notifications = getNotifications(notification.userId);
  const newNotification: Notification = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    ...notification,
  };
  notifications.push(newNotification);
  localStorage.setItem('notifications', JSON.stringify(notifications));
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

export const markAllNotificationsAsRead = (userId: string) => {
  const notificationsString = localStorage.getItem('notifications');
  if (!notificationsString) return;

  const notifications: Notification[] = JSON.parse(notificationsString);
  let updated = false;
  
  notifications.forEach(notification => {
    if (notification.userId === userId && !notification.read) {
      notification.read = true;
      updated = true;
    }
  });
  
  if (updated) {
    localStorage.setItem('notifications', JSON.stringify(notifications));
  }
};
