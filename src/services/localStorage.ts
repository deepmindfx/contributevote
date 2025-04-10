
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

// Add any other localStorage related functions that need to be exported
