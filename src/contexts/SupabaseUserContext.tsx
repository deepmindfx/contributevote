import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react';
import { UserService } from '@/services/supabase/userService';
import { SyncService } from '@/services/supabase/syncService';
import { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { SECURITY_CONSTANTS } from '@/lib/security';

type Profile = Database['public']['Tables']['profiles']['Row'];

type SessionMetadata = {
  lastActivity: number;
  expiresAt: number;
};

const USER_STORAGE_KEY = 'currentUser';
const SESSION_METADATA_KEY = 'auth_session_metadata_v1';
const SESSION_ACTIVITY_WRITE_INTERVAL = 60 * 1000; // 1 minute throttling for storage writes
const SESSION_TIMEOUT_MS = (() => {
  const envMinutes = Number(import.meta.env.VITE_SESSION_TIMEOUT_MINUTES);
  if (!Number.isNaN(envMinutes) && envMinutes > 0) {
    return envMinutes * 60 * 1000;
  }
  return SECURITY_CONSTANTS.SESSION_TIMEOUT;
})();

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = ['click', 'keydown', 'touchstart', 'focus'];

const hasBrowserStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const readStoredUserProfile = (): Profile | null => {
  if (!hasBrowserStorage()) return null;
  const cached = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!cached) return null;
  try {
    return JSON.parse(cached) as Profile;
  } catch (error) {
    console.warn('Failed to parse cached user profile, clearing storage', error);
    window.localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
};

const readStoredSessionMetadata = (): SessionMetadata | null => {
  if (!hasBrowserStorage()) return null;
  const raw = window.localStorage.getItem(SESSION_METADATA_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.lastActivity === 'number' && typeof parsed.expiresAt === 'number') {
      return parsed as SessionMetadata;
    }
  } catch (error) {
    console.warn('Failed to parse session metadata, clearing storage', error);
  }
  window.localStorage.removeItem(SESSION_METADATA_KEY);
  return null;
};

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
  logout: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ success: boolean; user?: Profile; error?: string }>;
  register: (userData: { name: string; email: string; phone?: string }) => Promise<{ success: boolean; user?: Profile; error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: { message: string } }>;
  signUp: (email: string, password: string, metadata: { name: string; phone?: string }) => Promise<{ error?: { message: string } }>;
}

const SupabaseUserContext = createContext<SupabaseUserContextType | undefined>(undefined);

export function SupabaseUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(() => readStoredUserProfile());
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionMetadata, setSessionMetadata] = useState<SessionMetadata | null>(() =>
    readStoredSessionMetadata()
  );
  const sessionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(sessionMetadata?.lastActivity ?? 0);

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin';

  const clearSessionTimer = useCallback(() => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
      sessionTimeoutRef.current = null;
    }
  }, []);

  const persistSessionMetadata = useCallback((metadata: SessionMetadata | null) => {
    setSessionMetadata(metadata);
    if (!hasBrowserStorage()) return;
    if (!metadata) {
      window.localStorage.removeItem(SESSION_METADATA_KEY);
      return;
    }
    window.localStorage.setItem(SESSION_METADATA_KEY, JSON.stringify(metadata));
  }, []);

  const clearSessionState = useCallback(() => {
    setUser(null);
    clearSessionTimer();
    if (hasBrowserStorage()) {
      window.localStorage.removeItem(USER_STORAGE_KEY);
    }
    persistSessionMetadata(null);
  }, [clearSessionTimer, persistSessionMetadata]);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      clearSessionState();
    }
  }, [clearSessionState]);

  const handleSessionExpiry = useCallback(
    async (reason: 'timeout' | 'expired_on_load') => {
      console.warn('Auth session ended', { reason });
      await logout();
    },
    [logout]
  );

  const scheduleSessionTimeout = useCallback(
    (expiresAt: number | null) => {
      if (!expiresAt || typeof window === 'undefined') return;
      clearSessionTimer();
      const delay = Math.max(expiresAt - Date.now(), 0);
      sessionTimeoutRef.current = window.setTimeout(() => {
        handleSessionExpiry('timeout');
      }, delay);
    },
    [clearSessionTimer, handleSessionExpiry]
  );

  const refreshSessionActivity = useCallback(
    (force = false) => {
      if (!user) return;
      const now = Date.now();
      if (!force && now - lastActivityRef.current < SESSION_ACTIVITY_WRITE_INTERVAL) {
        return;
      }
      lastActivityRef.current = now;
      const metadata: SessionMetadata = {
        lastActivity: now,
        expiresAt: now + SESSION_TIMEOUT_MS
      };
      persistSessionMetadata(metadata);
      scheduleSessionTimeout(metadata.expiresAt);
    },
    [user, persistSessionMetadata, scheduleSessionTimeout]
  );

  useEffect(() => {
    if (!sessionMetadata?.expiresAt) {
      clearSessionTimer();
      return;
    }

    if (sessionMetadata.expiresAt <= Date.now()) {
      handleSessionExpiry('expired_on_load');
      return;
    }

    scheduleSessionTimeout(sessionMetadata.expiresAt);

    return () => {
      clearSessionTimer();
    };
  }, [sessionMetadata?.expiresAt, scheduleSessionTimeout, handleSessionExpiry, clearSessionTimer]);

  useEffect(() => {
    if (!user?.id) {
      if (sessionMetadata) {
        persistSessionMetadata(null);
      }
      clearSessionTimer();
      return;
    }

    refreshSessionActivity(true);
  }, [user?.id, sessionMetadata, refreshSessionActivity, persistSessionMetadata, clearSessionTimer]);

  useEffect(() => {
    if (!user) {
      clearSessionTimer();
      return;
    }

    const activityHandler = () => refreshSessionActivity();
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        refreshSessionActivity(true);
      }
    };

    ACTIVITY_EVENTS.forEach(event => window.addEventListener(event, activityHandler));
    document.addEventListener('visibilitychange', visibilityHandler);

    return () => {
      ACTIVITY_EVENTS.forEach(event => window.removeEventListener(event, activityHandler));
      document.removeEventListener('visibilitychange', visibilityHandler);
    };
  }, [user, refreshSessionActivity, clearSessionTimer]);

  // Load user data on mount and set up auth listener
  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;
    
    const initializeAuth = async () => {
      try {
        // Set a timeout to prevent infinite loading (10 seconds for slower connections)
        timeoutId = setTimeout(() => {
          if (mounted) {
            console.warn('Auth initialization timeout - setting loading to false');
            setLoading(false);
          }
        }, 10000); // 10 second timeout
        
        // Get initial session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Error getting session:', sessionError);
        }
        
        if (session?.user && mounted) {
          console.log('Found session for user:', session.user.id);
          // User is already signed in, fetch their profile
          try {
            // Add timeout to profile fetch
            const profilePromise = UserService.getUserById(session.user.id);
            const timeoutPromise = new Promise<null>((_, reject) => 
              setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
            );
            
            let profile = await Promise.race([profilePromise, timeoutPromise]);
            
            // If profile doesn't exist, create it
            if (!profile) {
              console.log('Profile not found, creating new profile');
              const newProfile = {
                id: session.user.id,
                name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
                email: session.user.email || '',
                phone: session.user.user_metadata?.phone || null,
                wallet_balance: 0,
                role: 'user' as const,
                status: 'active' as const,
                preferences: {
                  darkMode: false,
                  anonymousContributions: false,
                  notificationsEnabled: true
                }
              };
              
              try {
                profile = await UserService.createUser(newProfile);
                console.log('Profile created successfully');
              } catch (createError) {
                console.error('Error creating profile:', createError);
                profile = newProfile as any;
              }
            }
            
            if (profile && mounted) {
              console.log('Setting user profile:', profile.email);
              setUser(profile);
              localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile));
            }
          } catch (error) {
            console.error('Error fetching user profile:', error);
            // If profile fetch fails, try to use cached data
            const cachedUser = localStorage.getItem(USER_STORAGE_KEY);
            if (cachedUser && mounted) {
              try {
                const parsedUser = JSON.parse(cachedUser);
                console.log('Using cached user profile:', parsedUser.email);
                setUser(parsedUser);
              } catch (parseError) {
                console.error('Error parsing cached user:', parseError);
              }
            }
          }
        } else if (mounted) {
          console.log('No active session found');
        }
        
        // Load other data (but don't let it block)
        loadInitialData().catch(err => {
          console.error('Error loading initial data:', err);
        });
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        clearTimeout(timeoutId);
        if (mounted) {
          setLoading(false);
        }
      }
    };
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
      
      if (event === 'SIGNED_IN' && session?.user && mounted) {
        console.log('User signed in, fetching profile...');
        setLoading(true); // Show loading while fetching profile
        
        try {
          // Add timeout to profile fetch
          const profilePromise = UserService.getUserById(session.user.id);
          const timeoutPromise = new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
          );
          
          let profile = await Promise.race([profilePromise, timeoutPromise]);
          
          if (!profile) {
            console.log('Creating new profile for signed in user');
            const newProfile = {
              id: session.user.id,
              name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
              email: session.user.email || '',
              phone: session.user.user_metadata?.phone || null,
              wallet_balance: 0,
              role: 'user' as const,
              status: 'active' as const,
              preferences: {
                darkMode: false,
                anonymousContributions: false,
                notificationsEnabled: true
              }
            };
            
            try {
              profile = await UserService.createUser(newProfile);
            } catch (createError) {
              console.error('Error creating profile:', createError);
              profile = newProfile as any;
            }
          }
          
          if (profile && mounted) {
            console.log('Profile loaded successfully:', profile.email);
            setUser(profile);
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile));
          }
        } catch (error) {
          console.error('Error fetching user profile after sign in:', error);
          // Try cached data as fallback
          const cachedUser = localStorage.getItem(USER_STORAGE_KEY);
          if (cachedUser && mounted) {
            try {
              const parsedUser = JSON.parse(cachedUser);
              console.log('Using cached profile after sign in error');
              setUser(parsedUser);
              
              // Try to refresh with fresh data in background
              setTimeout(async () => {
                try {
                  const freshProfile = await UserService.getUserById(session.user.id);
                  if (freshProfile && mounted) {
                    console.log('Refreshed profile with fresh data');
                    setUser(freshProfile);
                    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(freshProfile));
                  }
                } catch (refreshError) {
                  console.log('Background refresh failed, real-time will sync');
                }
              }, 1000); // Try again after 1 second
            } catch (parseError) {
              console.error('Error parsing cached user:', parseError);
            }
          }
        } finally {
          if (mounted) {
            console.log('Sign in process complete, stopping loading');
            setLoading(false);
          }
        }
      } else if (event === 'SIGNED_OUT' && mounted) {
        console.log('User signed out');
        clearSessionState();
        setLoading(false);
      } else if (event === 'INITIAL_SESSION') {
        // Initial session is handled in initializeAuth
        console.log('Initial session event');
      }
    });

    initializeAuth();

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
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
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedProfile));
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
      // Load all users for admin functionality (with timeout)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout loading users')), 3000)
      );
      
      const usersPromise = UserService.getUsers();
      
      const allUsers = await Promise.race([usersPromise, timeoutPromise]) as Profile[];
      setUsers(allUsers);
    } catch (error) {
      console.error('Error loading initial data:', error);
      // Set empty array on error so app doesn't hang
      setUsers([]);
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
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(freshUser));
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
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(foundUser));
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
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
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
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
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

  // Proper Supabase Auth functions
  const signIn = async (email: string, password: string) => {
    try {
      // Use Supabase Auth for proper authentication
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return { error: { message: error.message } };
      }

      // The onAuthStateChange listener will handle setting the user
      // Just return success here
      return { error: null };
    } catch (error: any) {
      return { error: { message: error.message || 'Login failed' } };
    }
  };

  const signUp = async (email: string, password: string, metadata: { name: string; phone?: string }) => {
    try {
      // Use Supabase Auth for proper registration
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: metadata.name,
            phone: metadata.phone
          }
        }
      });

      if (error) {
        return { error: { message: error.message } };
      }

      // Profile will be automatically created by database trigger
      // User needs to verify email before they can log in
      // Don't set user state here - they need to verify email first

      return { error: null };
    } catch (error: any) {
      return { error: { message: error.message || 'Registration failed' } };
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