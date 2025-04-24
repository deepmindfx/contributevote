
import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, getCurrentUser, getUsers, updateUser, updateUserById, pauseUser, activateUser, depositToUser, getUserByEmail, getUserByPhone, verifyUserWithOTP, logoutUser } from '@/services/localStorage';
import { toast } from 'sonner';

interface UserContextType {
  user: User;
  users: User[];
  isAdmin: boolean;
  isAuthenticated: boolean;
  refreshUserData: () => void;
  updateProfile: (userData: Partial<User>) => void;
  updateUserAsAdmin: (userId: string, userData: Partial<User>) => void;
  depositToUserAsAdmin: (userId: string, amount: number) => void;
  pauseUserAsAdmin: (userId: string) => void;
  activateUserAsAdmin: (userId: string) => void;
  getUserByEmail: (email: string) => User | null;
  getUserByPhone: (phone: string) => User | null;
  verifyUser: (userId: string) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>({} as User);
  const [users, setUsers] = useState<User[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Reset state when provider mounts
  useEffect(() => {
    const initUserData = () => {
      const currentUser = getCurrentUser();
      if (currentUser && currentUser.id) {
        setUser(currentUser);
        setUsers(getUsers());
        setIsAuthenticated(true);
        setIsAdmin(currentUser?.role === 'admin');
      } else {
        // Ensure clean state for new users
        setUser({} as User);
        setUsers([]);
        setIsAuthenticated(false);
        setIsAdmin(false);
      }
    };

    initUserData();
  }, []);

  // Effect for dark mode
  useEffect(() => {
    if (user?.preferences?.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [user?.preferences?.darkMode]);

  const refreshUserData = () => {
    const currentUser = getCurrentUser();
    
    if (currentUser && currentUser.id) {
      setUser(currentUser);
      setUsers(getUsers());
      setIsAuthenticated(true); 
      setIsAdmin(currentUser?.role === 'admin');
    } else {
      // Clear data if no user is found
      setUser({} as User);
      setUsers([]);
      setIsAuthenticated(false);
      setIsAdmin(false);
    }
  };

  const logout = () => {
    logoutUser();
    // Explicitly clear state
    setUser({} as User);
    setUsers([]);
    setIsAuthenticated(false);
    setIsAdmin(false);
    toast.success("You have been logged out successfully");
  };
  
  const updateProfile = (userData: Partial<User>) => {
    try {
      updateUser(userData);
      refreshUserData();
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
      console.error(error);
    }
  };

  // Admin functions
  const updateUserAsAdmin = (userId: string, userData: Partial<User>) => {
    try {
      if (!isAdmin) {
        toast.error('Unauthorized access');
        return;
      }

      updateUserById(userId, userData);
      refreshUserData();
      toast.success('User updated successfully');
    } catch (error) {
      toast.error('Failed to update user');
      console.error(error);
    }
  };

  const depositToUserAsAdmin = (userId: string, amount: number) => {
    try {
      if (!isAdmin) {
        toast.error('Unauthorized access');
        return;
      }

      depositToUser(userId, amount);
      refreshUserData();
      toast.success(`Successfully deposited ₦${amount.toLocaleString()} to user`);
    } catch (error) {
      toast.error('Failed to deposit funds');
      console.error(error);
    }
  };

  const pauseUserAsAdmin = (userId: string) => {
    try {
      if (!isAdmin) {
        toast.error('Unauthorized access');
        return;
      }

      pauseUser(userId);
      refreshUserData();
      toast.success('User paused successfully');
    } catch (error) {
      toast.error('Failed to pause user');
      console.error(error);
    }
  };

  const activateUserAsAdmin = (userId: string) => {
    try {
      if (!isAdmin) {
        toast.error('Unauthorized access');
        return;
      }

      activateUser(userId);
      refreshUserData();
      toast.success('User activated successfully');
    } catch (error) {
      toast.error('Failed to activate user');
      console.error(error);
    }
  };
  
  const verifyUser = (userId: string) => {
    try {
      // In a real app, this would be called after OTP verification
      verifyUserWithOTP(userId);
      refreshUserData();
      toast.success('User verified successfully');
    } catch (error) {
      toast.error('Failed to verify user');
      console.error(error);
    }
  };

  return (
    <UserContext.Provider value={{
      user,
      users,
      isAdmin,
      isAuthenticated,
      refreshUserData,
      updateProfile,
      updateUserAsAdmin,
      depositToUserAsAdmin,
      pauseUserAsAdmin,
      activateUserAsAdmin,
      getUserByEmail,
      getUserByPhone,
      verifyUser,
      logout,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
