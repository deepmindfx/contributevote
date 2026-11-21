import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { UserService } from '@/services/supabase/userService';
import { SyncService } from '@/services/supabase/syncService';
import { NotificationService, NotificationRecord } from '@/services/supabase/notificationService';
import { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface SupabaseUserContextType {
  user: Profile | null;
  users: Profile[];
  notifications: NotificationRecord[];
  unreadNotificationCount: number;
  isAdmin: boolean;
  isAuthenticated: boolean;
  loading: boolean;
  refreshUserData: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
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
  register: (userData: { name: string; email: string; phone?: string; password?: string }) => Promise<{ success: boolean; user?: Profile; error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: { message: string } | null; profile?: Profile | null }>;
  signUp: (email: string, password: string, metadata: { name: string; phone?: string }) => Promise<{ error?: { message: string } | null }>;
}

const SupabaseUserContext = createContext<SupabaseUserContextType | undefined>(undefined);

export function SupabaseUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin';
  const unreadNotificationCount = notifications.filter((n) => !n.is_read).length;

  const fetchNotificationsForUser = useCallback(async (userId: string) => {
    const data = await NotificationService.getUserNotifications(userId);
    setNotifications(data);
  }, []);

  const loadAdminUsers = useCallback(async (profile: Profile | null) => {
    if (profile?.role !== 'admin') {
      setUsers([]);
      return;
    }
    try {
      const allUsers = await UserService.getUsers();
      setUsers(allUsers);
    } catch (error) {
      console.error('Error loading users for admin:', error);
      setUsers([]);
    }
  }, []);

  const resolveUserProfile = useCallback(async (authUser: any): Promise<Profile | null> => {
    const profilePromise = UserService.getUserById(authUser.id);
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Profile fetch timeout')), 6000)
    );

    let profile = await Promise.race([profilePromise, timeoutPromise]);

    if (!profile) {
      const newProfile = {
        id: authUser.id,
        name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
        email: authUser.email || '',
        phone: authUser.user_metadata?.phone || null,
        wallet_balance: 0,
        role: 'user',
        status: 'active',
        preferences: {
          darkMode: false,
          anonymousContributions: false,
          notificationsEnabled: true,
        },
      };

      try {
        profile = await UserService.createUser(newProfile);
      } catch (createError) {
        console.error('Error creating profile:', createError);
        profile = newProfile as unknown as Profile;
      }
    }

    return profile;
  }, []);

  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    const initializeAuth = async () => {
      try {
        timeoutId = setTimeout(() => {
          if (mounted) {
            setLoading(false);
          }
        }, 10000);

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('Error getting session:', sessionError);
        }

        if (session?.user && mounted) {
          try {
            const profile = await resolveUserProfile(session.user);
            if (profile && mounted) {
              setUser(profile);
              localStorage.setItem('currentUser', JSON.stringify(profile));
              fetchNotificationsForUser(profile.id);
              loadAdminUsers(profile);
            }
          } catch (error) {
            console.error('Error fetching user profile:', error);
            const cachedUser = localStorage.getItem('currentUser');
            if (cachedUser && mounted) {
              try {
                const parsedUser = JSON.parse(cachedUser);
                if (parsedUser?.id === session.user.id) {
                  setUser(parsedUser);
                }
              } catch (parseError) {
                console.error('Error parsing cached user:', parseError);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        clearTimeout(timeoutId);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user && mounted) {
        try {
          const profile = await resolveUserProfile(session.user);
          if (profile && mounted) {
            setUser(profile);
            localStorage.setItem('currentUser', JSON.stringify(profile));
            fetchNotificationsForUser(profile.id);
            loadAdminUsers(profile);
          }
        } catch (error) {
          console.error('Error fetching user profile after sign in:', error);
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      } else if (event === 'SIGNED_OUT' && mounted) {
        setUser(null);
        setUsers([]);
        setNotifications([]);
        localStorage.removeItem('currentUser');
        setLoading(false);
      }
    });

    initializeAuth();

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [fetchNotificationsForUser, loadAdminUsers, resolveUserProfile]);

  // Real-time subscription for profile and notifications updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`user-realtime-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const updatedProfile = payload.new as Profile;
          setUser(updatedProfile);
          localStorage.setItem('currentUser', JSON.stringify(updatedProfile));
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchNotificationsForUser(user.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchNotificationsForUser]);

  const refreshNotifications = useCallback(async () => {
    if (user?.id) {
      await fetchNotificationsForUser(user.id);
    }
  }, [user?.id, fetchNotificationsForUser]);

  const markNotificationRead = useCallback(async (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
    );
    await NotificationService.markAsRead(notificationId);
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    if (!user?.id) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await NotificationService.markAllAsRead(user.id);
  }, [user?.id]);

  const refreshCurrentUser = useCallback(async () => {
    try {
      if (user?.id) {
        const freshUser = await SyncService.syncUserData(user.id);
        if (freshUser) {
          setUser(freshUser);
          localStorage.setItem('currentUser', JSON.stringify(freshUser));
        }
      }
    } catch (error) {
      console.error('Error refreshing current user:', error);
    }
  }, [user?.id]);

  const refreshUserData = useCallback(async () => {
    try {
      if (user?.role === 'admin') {
        const allUsers = await UserService.getUsers();
        setUsers(allUsers);
      }
      if (user?.id) {
        await refreshCurrentUser();
        await fetchNotificationsForUser(user.id);
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  }, [user?.id, user?.role, refreshCurrentUser, fetchNotificationsForUser]);

  // Proper Supabase Auth signIn
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { error: { message: error.message }, profile: null };
      }

      let profile: Profile | null = null;
      if (data.user) {
        profile = await resolveUserProfile(data.user);
        if (profile) {
          setUser(profile);
          localStorage.setItem('currentUser', JSON.stringify(profile));
          fetchNotificationsForUser(profile.id);
          loadAdminUsers(profile);
        }
      }

      return { error: null, profile };
    } catch (error: any) {
      return { error: { message: error?.message || 'Login failed' }, profile: null };
    }
  };

  const signUp = async (email: string, password: string, metadata: { name: string; phone?: string }) => {
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: metadata.name,
            phone: metadata.phone,
          },
        },
      });

      if (error) {
        return { error: { message: error.message } };
      }

      return { error: null };
    } catch (error: any) {
      return { error: { message: error?.message || 'Registration failed' } };
    }
  };

  // Backwards-compatible login wrapper backed strictly by Supabase Auth
  const login = async (email: string, password: string) => {
    const { error, profile } = await signIn(email, password);
    if (error || !profile) {
      return { success: false, error: error?.message || 'Login failed' };
    }
    return { success: true, user: profile };
  };

  const register = async (userData: { name: string; email: string; phone?: string; password?: string }) => {
    if (!userData.password) {
      return { success: false, error: 'Password is required' };
    }
    const { error } = await signUp(userData.email, userData.password, {
      name: userData.name,
      phone: userData.phone,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  };

  const updateProfile = async (userData: Partial<Profile>) => {
    if (!user) throw new Error('No user logged in');

    const updatedUser = await UserService.updateUser(user.id, userData);
    setUser(updatedUser);
    localStorage.setItem('currentUser', JSON.stringify(updatedUser));
    if (updatedUser.role === 'admin') {
      await loadAdminUsers(updatedUser);
    }
  };

  const updateUserAsAdmin = async (userId: string, userData: Partial<Profile>) => {
    if (!isAdmin) throw new Error('Admin access required');

    await UserService.updateUser(userId, userData);
    await refreshUserData();
  };

  const depositToUserAsAdmin = async (userId: string, amount: number) => {
    if (!isAdmin) throw new Error('Admin access required');

    const { data, error } = await (supabase as any).rpc('admin_deposit_to_user', {
      p_target_user_id: userId,
      p_amount: amount,
      p_description: 'Admin wallet credit',
    });

    if (error) throw error;
    if (!data?.success) {
      throw new Error(data?.error || 'Failed to deposit to user');
    }

    await refreshUserData();
  };

  const pauseUserAsAdmin = async (userId: string) => {
    if (!isAdmin) throw new Error('Admin access required');
    await UserService.updateUser(userId, { status: 'paused' });
    await refreshUserData();
  };

  const activateUserAsAdmin = async (userId: string) => {
    if (!isAdmin) throw new Error('Admin access required');
    await UserService.updateUser(userId, { status: 'active' });
    await refreshUserData();
  };

  const getUserByEmail = async (email: string) => {
    return await UserService.getUserByEmail(email);
  };

  const getUserByPhone = async (phone: string) => {
    const allUsers = await UserService.getUsers();
    return allUsers.find((u) => u.phone === phone) || null;
  };

  const verifyUser = async (userId: string) => {
    await UserService.updateUser(userId, { status: 'verified' });
    await refreshUserData();
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      setUser(null);
      setUsers([]);
      setNotifications([]);
      localStorage.removeItem('currentUser');
    }
  };

  return (
    <SupabaseUserContext.Provider
      value={{
        user,
        users,
        notifications,
        unreadNotificationCount,
        isAdmin,
        isAuthenticated,
        loading,
        refreshUserData,
        refreshCurrentUser,
        refreshNotifications,
        markNotificationRead,
        markAllNotificationsRead,
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
      }}
    >
      {children}
    </SupabaseUserContext.Provider>
  );
}

export function useSupabaseUser() {
  const context = useContext(SupabaseUserContext);
  if (context === undefined) {
    throw new Error('useSupabaseUser must be used within a SupabaseUserProvider.');
  }
  return context;
}
