import { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@/types';

// Define the AppContext interface
interface AppContextProps {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  isAdmin: boolean;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
  createNewContribution: (contributionData: any) => void;
  updateUser: (userData: Partial<User>) => void;
  refreshUser: () => void;
}

// Create the AppContext
const AppContext = createContext<AppContextProps | undefined>(undefined);

// Create a custom hook to use the AppContext
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

// Create a provider component
export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    // Get user from localStorage on initialization
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  
  const isAdmin = user?.role === 'admin';
  const isAuthenticated = !!user;
  
  useEffect(() => {
    // Update localStorage when user changes
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);
  
  // Function to update user in localStorage
  const updateUserInStorage = (updatedUser: User) => {
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };
  
  // Function to handle login
  const login = (user: User) => {
    setUser(user);
  };
  
  // Function to handle logout
  const logout = () => {
    setUser(null);
  };
  
  // Function to create a new contribution (dummy implementation)
  const createNewContribution = (contributionData: any) => {
    console.log('Creating new contribution:', contributionData);
    // Implement your logic here
  };

  // Fix the updateUser function to accept a partial user object
  const updateUser = (userData: Partial<User>) => {
    setUser(prevUser => {
      if (!prevUser) return null;
    
      // Merge existing user with new data, ensuring required properties exist
      const updatedUser = {
        ...prevUser,
        ...userData,
      };
    
      // Save to localStorage
      updateUserInStorage(updatedUser);
    
      // Return updated user
      return updatedUser;
    });
  };
  
  // Function to refresh user data from localStorage
  const refreshUser = () => {
    const storedUser = localStorage.getItem('user');
    setUser(storedUser ? JSON.parse(storedUser) : null);
  };
  
  return (
    <AppContext.Provider value={{
      user,
      setUser,
      isAdmin,
      isAuthenticated,
      login,
      logout,
      createNewContribution,
      updateUser,
      refreshUser,
    }}>
      {children}
    </AppContext.Provider>
  );
};
