
import { v4 as uuidv4 } from "uuid";
import { User, localStorageKeys } from "./types";

/**
 * Function to get all users from local storage
 * @returns {User[]} - An array of users
 */
export const getUsers = (): User[] => {
  const users = localStorage.getItem(localStorageKeys.users);
  return users ? JSON.parse(users) : [];
};

/**
 * Function to get user by ID
 */
export const getUserById = (id: string): User | undefined => {
  const users = getUsers();
  return users.find((user) => user.id === id);
};

/**
 * Function to get the current logged-in user
 */
export const getCurrentUser = (): User | null => {
  const userString = localStorage.getItem(localStorageKeys.currentUser);
  if (!userString) return null;
  return JSON.parse(userString);
};

/**
 * Function to update user information
 */
export const updateUser = (userData: Partial<User>): User | null => {
  const currentUser = getCurrentUser();
  if (!currentUser) return null;
  
  const updatedUser = { ...currentUser, ...userData };
  localStorage.setItem(localStorageKeys.currentUser, JSON.stringify(updatedUser));
  
  // Also update the user in the users array
  const users = getUsers();
  const updatedUsers = users.map(user => 
    user.id === currentUser.id ? updatedUser : user
  );
  localStorage.setItem(localStorageKeys.users, JSON.stringify(updatedUsers));
  
  return updatedUser;
};

/**
 * Function to update a user by ID
 */
export const updateUserById = (userId: string, userData: Partial<User>): User | null => {
  const users = getUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex >= 0) {
    users[userIndex] = { ...users[userIndex], ...userData };
    localStorage.setItem(localStorageKeys.users, JSON.stringify(users));
    
    // If this is the current user, update that too
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      const updatedUser = { ...currentUser, ...userData };
      localStorage.setItem(localStorageKeys.currentUser, JSON.stringify(updatedUser));
      return updatedUser;
    }
    
    return users[userIndex];
  }
  return null;
};

/**
 * Function to add a new user to local storage
 */
export const addUser = (userData: Omit<User, "id">): User => {
  const users = getUsers();
  const newUser: User = {
    id: uuidv4(),
    ...userData,
  };
  localStorage.setItem(localStorageKeys.users, JSON.stringify([...users, newUser]));
  return newUser;
};

/**
 * Function to update a user's wallet balance
 */
export const updateUserBalance = (amount: number): User | undefined => {
  // Get the current user from local storage
  const currentUser = getCurrentUser();
  if (!currentUser) {
    console.error("No current user found in local storage");
    return undefined;
  }
  
  return updateUserById(currentUser.id, {
    walletBalance: Math.max(0, currentUser.walletBalance + amount)
  });
};

/**
 * Function to deposit money to a user's wallet
 */
export const depositToUser = (userId: string, amount: number): User | null => {
  const users = getUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return null;
  
  return updateUserById(userId, {
    walletBalance: user.walletBalance + amount
  });
};

/**
 * Function to activate a user account
 */
export const activateUser = (userId: string): void => {
  try {
    updateUserById(userId, { status: "active" });
  } catch (error) {
    console.error("Error in activateUser:", error);
  }
};

/**
 * Function to pause a user account
 */
export const pauseUser = (userId: string): void => {
  try {
    updateUserById(userId, { status: "paused" });
  } catch (error) {
    console.error("Error in pauseUser:", error);
  }
};

/**
 * Function to verify a user with OTP
 */
export const verifyUserWithOTP = (userId: string): void => {
  try {
    updateUserById(userId, { verified: true });
  } catch (error) {
    console.error("Error in verifyUserWithOTP:", error);
  }
};

/**
 * Function to get user by email
 */
export const getUserByEmail = (email: string): User | null => {
  const users = getUsers();
  return users.find(user => user.email === email) || null;
};

/**
 * Function to get user by phone
 */
export const getUserByPhone = (phone: string): User | null => {
  const users = getUsers();
  return users.find(user => user.phone === phone) || null;
};

/**
 * Function to log out the current user
 */
export const logoutUser = (): void => {
  localStorage.removeItem(localStorageKeys.currentUser);
};

/**
 * Function to mark all notifications as read
 */
export const markAllNotificationsAsRead = (userId?: string): void => {
  const currentUser = getCurrentUser();
  if (!userId && !currentUser) return;
  
  const targetUserId = userId || currentUser!.id;
  const user = getUserById(targetUserId);
  
  if (user && user.notifications && user.notifications.length > 0) {
    const updatedNotifications = user.notifications.map(n => ({
      ...n,
      read: true
    }));
    
    updateUserById(targetUserId, { notifications: updatedNotifications });
  }
};

/**
 * Function to mark a specific notification as read
 */
export const markNotificationAsRead = (notificationId: string, userId?: string): void => {
  const currentUser = getCurrentUser();
  if (!userId && !currentUser) return;
  
  const targetUserId = userId || currentUser!.id;
  const user = getUserById(targetUserId);
  
  if (user && user.notifications) {
    const updatedNotifications = user.notifications.map(n => 
      n.id === notificationId ? { ...n, read: true } : n
    );
    
    updateUserById(targetUserId, { notifications: updatedNotifications });
  }
};

/**
 * Function to add a notification
 */
export const addNotification = (notification: any) => {
  // Implementation for adding notifications to a user
  const { userId, ...notificationData } = notification;
  const user = getUserById(userId);
  
  if (user) {
    const newNotification = {
      id: uuidv4(),
      read: false,
      createdAt: new Date().toISOString(),
      ...notificationData
    };
    
    const notifications = user.notifications || [];
    updateUserById(userId, {
      notifications: [newNotification, ...notifications]
    });
  }
};
