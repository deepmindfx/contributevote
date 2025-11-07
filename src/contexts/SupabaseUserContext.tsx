import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { UserService } from '@/services/supabase/userService';
import { SyncService } from '@/services/supabase/syncService';
import { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface SupabaseUserContextType {
  user: Profile | null;
  users: Profile[];
  isAdmin: boolean;
  isAuthenticated: boolean;
  loading: boolean;
  refreshUserData: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
  updateProfile: (userData: Partial<Profile>) => Promise<void>;
  updateUserAsAdmin: (userId: string, userData: Partial<Profile>) => Promise<void>;
  depositToUserAsAdmin: (userId: string, amount: number) => Promise<void>;
  pauseUserAsAdmin: (userId: string) => Promise<void>;
  activateUserAsAdmin: (userId: string) => Promise<void>;
  getUserByEmail: (email: string) => Promise<Profile | null>;
  getUserByPhone: (phone: string) => Promise<Profile | null>;
  verifyUser: (userId: string) => Promise<void>;
  logout: () => void;
  login: (email: string, password: string) => Promise<{ success: boolean; user?: Profile; error?: string }>;
  register: (userData: { name: string; email: string; phone?: string }) => Promise<{ success: boolean; user?: Profile; error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: { message: string } }>;
  signUp: (email: string, password: string, metadata: { name: string; phone?: string }) => Promise<{ error?: { message: string } }>;
}

const SupabaseUserContext = createContext<SupabaseUserContextType | undefined>(undefined);

export function SupabaseUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin';

  // Load user data on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  // Set up real-time subscription for profile updates
  useEffect(() => {
    if (!user?.id) return;

    // Subscribe to changes on the current user's profile
    const channel = supabase
      .channel(`profile-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          const updatedProfile = payload.new as Profile;
          setUser(updatedProfile);
          localStorage.setItem('currentUser', JSON.stringify(updatedProfile));
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Check if user is logged in (from localStorage for now)
      const currentUserData = localStorage.getItem('currentUser');
      if (currentUserData) {
        const userData = JSON.parse(currentUserData);
        // Fetch fresh user data from Supabase
        const freshUser = await UserService.getUserById(userData.id);
        if (freshUser) {
          setUser(freshUser);
        }
      }
      
      // Load all users if admin
      await refreshUserData();
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshUserData = async () => {
    try {
      // Refresh all users
      const allUsers = await UserService.getUsers();
      setUsers(allUsers);
      
      // Refresh current user data if logged in
      if (user?.id) {
        await refreshCurrentUser();
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };

  const refreshCurrentUser = async () => {
    try {
      if (user?.id) {
        // Use sync service to ensure data consistency
        const freshUser = await SyncService.syncUserData(user.id);
        if (freshUser) {
          setUser(freshUser);
          localStorage.setItem('currentUser', JSON.stringify(freshUser));
        }
      }
    } catch (error) {
      console.error('Error refreshing current user:', error);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      // For now, we'll use email-based login without password verification
      // In production, you'd want to implement proper Supabase Auth
      const foundUser = await UserService.getUserByEmail(email);
      
      if (foundUser) {
        setUser(foundUser);
        localStorage.setItem('currentUser', JSON.stringify(foundUser));
        return { success: true, user: foundUser };
      } else {
        return { success: false, error: 'User not found' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  };

  const register = async (userData: { name: string; email: string; phone?: string }) => {
    try {
      // Check if user already exists
      const existingUser = await UserService.getUserByEmail(userData.email);
      if (existingUser) {
        return { success: false, error: 'User already exists' };
      }

      // Generate a UUID for the new user
      const userId = crypto.randomUUID();

      // Create new user
      const newUser = await UserService.createUser({
        id: userId,
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        wallet_balance: 0,
        role: 'user',
        status: 'active',
        preferences: {
          darkMode: false,
          anonymousContributions: false,
          notificationsEnabled: true
        }
      });

      setUser(newUser);
      localStorage.setItem('currentUser', JSON.stringify(newUser));
      await refreshUserData();
      
      return { success: true, user: newUser };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: error.message };
    }
  };

  const updateProfile = async (userData: Partial<Profile>) => {
    if (!user) throw new Error('No user logged in');
    
    try {
      const updatedUser = await UserService.updateUser(user.id, userData);
      setUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      await refreshUserData();
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  const updateUserAsAdmin = async (userId: string, userData: Partial<Profile>) => {
    if (!isAdmin) throw new Error('Admin access required');
    
    try {
      await UserService.updateUser(userId, userData);
      await refreshUserData();
    } catch (error) {
      console.error('Error updating user as admin:', error);
      throw error;
    }
  };

  const depositToUserAsAdmin = async (userId: string, amount: number) => {
    if (!isAdmin) throw new Error('Admin access required');
    
    try {
      const targetUser = users.find(u => u.id === userId);
      if (!targetUser) throw new Error('User not found');
      
      const newBalance = (targetUser.wallet_balance || 0) + amount;
      await UserService.updateWalletBalance(userId, newBalance);
      await refreshUserData();
    } catch (error) {
      console.error('Error depositing to user:', error);
      throw error;
    }
  };

  const pauseUserAsAdmin = async (userId: string) => {
    if (!isAdmin) throw new Error('Admin access required');
    
    try {
      await UserService.updateUser(userId, { status: 'paused', role: 'paused' });
      await refreshUserData();
    } catch (error) {
      console.error('Error pausing user:', error);
      throw error;
    }
  };

  const activateUserAsAdmin = async (userId: string) => {
    if (!isAdmin) throw new Error('Admin access required');
    
    try {
      await UserService.updateUser(userId, { status: 'active', role: 'user' });
      await refreshUserData();
    } catch (error) {
      console.error('Error activating user:', error);
      throw error;
    }
  };

  const getUserByEmail = async (email: string) => {
    return await UserService.getUserByEmail(email);
  };

  const getUserByPhone = async (phone: string) => {
    // Note: This would need to be implemented in UserService
    const allUsers = await UserService.getUsers();
    return allUsers.find(u => u.phone === phone) || null;
  };

  const verifyUser = async (userId: string) => {
    try {
      await UserService.updateUser(userId, { status: 'verified' });
      await refreshUserData();
    } catch (error) {
      console.error('Error verifying user:', error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
  };

  // Wrapper functions for AuthForm compatibility
  const signIn = async (email: string, password: string) => {
    const result = await login(email, password);
    if (result.success) {
      return { error: null };
    } else {
      return { error: { message: result.error || 'Login failed' } };
    }
  };

  const signUp = async (email: string, password: string, metadata: { name: string; phone?: string }) => {
    const result = await register({
      name: metadata.name,
      email: email,
      phone: metadata.phone
    });
    if (result.success) {
      return { error: null };
    } else {
      return { error: { message: result.error || 'Registration failed' } };
    }
  };

  return (
    <SupabaseUserContext.Provider value={{
      user,
      users,
      isAdmin,
      isAuthenticated,
      loading,
      refreshUserData,
      refreshCurrentUser,
      updateProfile,
      updateUserAsAdmin,
      depositToUserAsAdmin,
      pauseUserAsAdmin,
      activateUserAsAdmin,
      getUserByEmail,
      getUserByPhone,
      verifyUser,
      logout,
      login,
      register,
      signIn,
      signUp,
    }}>
      {children}
    </SupabaseUserContext.Provider>
  );
}

export function useSupabaseUser() {
  const context = useContext(SupabaseUserContext);
  if (context === undefined) {
    console.error('useSupabaseUser called outside of SupabaseUserProvider');
    console.trace('Call stack:');
    throw new Error('useSupabaseUser must be used within a SupabaseUserProvider. Make sure the component is wrapped in <SupabaseUserProvider>.');
  }
  return context;
}