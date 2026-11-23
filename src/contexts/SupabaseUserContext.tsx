import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo, ReactNode } from 'react';
import { UserService } from '@/services/supabase/userService';
import type { User as AuthUser } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { notificationAllowed, notificationCategory, NotificationService, NotificationRecord, paymentVibrationEnabled } from '@/services/supabase/notificationService';
import { disablePush } from '@/services/pwa';
import { Database } from '@/integrations/supabase/types';
import {
  clearLocalSupabaseSession,
  hasStoredSupabaseSession,
  supabase,
} from '@/integrations/supabase/client';
import { passwordIssue } from '@/lib/passwordPolicy';
import { normalizeSignupPhone, SIGNUP_PHONE_ERROR } from '@/lib/signupPhone';
import { announcePayment } from '@/components/wallet/IncomingMoneyAlert';

function isInvalidSessionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { status?: number; code?: string; message?: string };
  if (err.status === 400 || err.status === 401 || err.status === 403) return true;
  const code = String(err.code || '').toLowerCase();
  if (['pgrst301', '42501', 'refresh_token_not_found', 'invalid_refresh_token', 'session_not_found', 'bad_jwt', 'invalid_grant'].includes(code)) {
    return true;
  }
  const msg = String(err.message || '').toLowerCase();
  return (
    msg.includes('refresh token') ||
    msg.includes('invalid_grant') ||
    msg.includes('session_not_found') ||
    msg.includes('session from session_id claim') ||
    msg.includes('jwt expired') ||
    msg.includes('invalid jwt') ||
    msg.includes('bad_jwt') ||
    msg.includes('user from sub claim') ||
    msg.includes('not authenticated')
  );
}

type Profile = Database['public']['Tables']['profiles']['Row'];

interface SupabaseUserContextType {
  user: Profile | null;
  users: Profile[];
  notifications: NotificationRecord[];
  unreadNotificationCount: number;
  isAdmin: boolean;
  isAuthenticated: boolean;
  loading: boolean;
  sessionUnavailable: boolean;
  retrySession: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  toggleNotificationRead: (notificationId: string, isRead: boolean) => Promise<boolean>;
  markAllNotificationsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<boolean>;
  clearReadNotifications: () => Promise<boolean>;
  clearAllNotifications: () => Promise<boolean>;
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
  const queryClient = useQueryClient();
  const [user, setUser] = useState<Profile | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionUnavailable, setSessionUnavailable] = useState(false);

  const sessionOwner = useRef<string | null>();
  const profileOwner = useRef<string>();
  const notificationPreferences = useRef<Profile["preferences"]>(null);
  notificationPreferences.current = user?.preferences ?? null;
  const sessionRevision = useRef(0);
  const profileTask = useRef<number>();
  const pendingProfile = useRef<{ id: string; request: Promise<Profile | null> }>();
  const notificationFetchVersion = useRef(0);
  const seenNotifications = useRef<{ owner: string; initialized: boolean; ids: Set<string> }>();
  const lastWallet = useRef<{ id: string; balance: number | null }>();

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin';
  const visibleNotifications = useMemo(() => notifications.filter(
    (notification) => notification.user_id === user?.id && notificationAllowed(notification.type, user?.preferences),
  ), [notifications, user?.id, user?.preferences]);
  const unreadNotificationCount = visibleNotifications.filter((n) => !n.is_read).length;

  const invalidatePaymentViews = useCallback((id: string, includeGroups: boolean) => {
    void queryClient.invalidateQueries({
      queryKey: ['workspace', id],
      predicate: ({ queryKey }) => queryKey[2] === 'transactions' || queryKey[2] === 'monthly-ledger' ||
        (includeGroups && (queryKey[2] === 'groups' || queryKey[2] === 'group' || queryKey[2] === 'group-analytics')),
    });
  }, [queryClient]);

  const recordNotifications = useCallback((id: string, rows: NotificationRecord[], fromRealtime = false) => {
    if (sessionOwner.current !== id) return;
    if (seenNotifications.current?.owner !== id) {
      seenNotifications.current = { owner: id, initialized: false, ids: new Set() };
    }
    const known = seenNotifications.current;
    const announce = fromRealtime || known.initialized;
    let walletChanged = false;
    let groupChanged = false;
    for (const row of rows) {
      if (row.user_id !== id || known.ids.has(row.id)) continue;
      known.ids.add(row.id);
      if (!announce) continue;
      const category = notificationCategory(row.type);
      walletChanged ||= category === 'wallet';
      groupChanged ||= category === 'group';
      const preferences = notificationPreferences.current;
      if (!row.is_read && notificationAllowed(row.type, preferences)) {
        announcePayment(row, paymentVibrationEnabled(preferences));
      }
    }
    if (!fromRealtime) known.initialized = true;
    if (walletChanged || groupChanged) invalidatePaymentViews(id, groupChanged);
  }, [invalidatePaymentViews]);

  const fetchNotificationsForUser = useCallback(async (userId: string) => {
    const version = ++notificationFetchVersion.current;
    try {
      const data = await NotificationService.getUserNotifications(userId, AbortSignal.timeout(10_000));
      if (sessionOwner.current !== userId || version !== notificationFetchVersion.current) return;
      recordNotifications(userId, data);
      setNotifications(data);
    } catch {
      // Keep the last inbox until the next successful sync.
    }
  }, [recordNotifications]);

  const liveUserId = user?.id;
  const liveWalletBalance = user?.wallet_balance ?? null;
  useEffect(() => {
    if (!liveUserId) { lastWallet.current = undefined; return; }
    const previous = lastWallet.current;
    lastWallet.current = { id: liveUserId, balance: liveWalletBalance };
    if (previous?.id === liveUserId && previous.balance !== liveWalletBalance) invalidatePaymentViews(liveUserId, false);
  }, [liveUserId, liveWalletBalance, invalidatePaymentViews]);

  const resolveUserProfile = useCallback(async (authUser: AuthUser): Promise<Profile | null> => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    let profile: Profile | null;
    try {
      profile = await UserService.getUserById(authUser.id, controller.signal);
    } finally {
      window.clearTimeout(timeout);
    }

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
          darkMode: true,
          anonymousContributions: false,
          notificationsEnabled: true,
        },
      };

      try {
        profile = await UserService.createUser(newProfile);
      } catch (createError) {
        if ((createError as { code?: string })?.code !== '23505') throw createError;
        profile = await UserService.getUserById(authUser.id);
      }
    }

    return profile;
  }, []);

  const loadSessionProfile = useCallback((authUser: AuthUser) => {
    if (pendingProfile.current?.id === authUser.id) return pendingProfile.current.request;
    const request = resolveUserProfile(authUser).catch(async (error) => {
      const code = (error as { code?: string })?.code;
      if (!navigator.onLine || !['', '503', '504'].includes(code ?? 'unknown')) throw error;
      await new Promise((resolve) => window.setTimeout(resolve, 650));
      if (sessionOwner.current !== authUser.id) throw error;
      return resolveUserProfile(authUser);
    }).finally(() => {
      if (pendingProfile.current?.request === request) pendingProfile.current = undefined;
    });
    pendingProfile.current = { id: authUser.id, request };
    return request;
  }, [resolveUserProfile]);

  const applyProfile = useCallback((profile: Profile) => {
    if (sessionOwner.current !== profile.id) return;
    profileOwner.current = profile.id;
    setSessionUnavailable(false);
    setUser((previous) => {
      if (previous?.id === profile.id && Date.parse(previous.updated_at || "") > Date.parse(profile.updated_at || "")) {
        return previous;
      }
      return profile;
    });
  }, []);

  const syncSession = useCallback((authUser: AuthUser | null) => {
    const nextId = authUser?.id ?? null;
    if (nextId === sessionOwner.current && profileTask.current !== undefined) return;
    if (nextId === sessionOwner.current && profileOwner.current === nextId) {
      setLoading(false);
      setSessionUnavailable(false);
      return;
    }

    if (sessionOwner.current !== nextId) {
      sessionOwner.current = nextId;
      seenNotifications.current = undefined;
      notificationFetchVersion.current++;
      profileOwner.current = undefined;
      pendingProfile.current = undefined;
      window.clearTimeout(profileTask.current);
      profileTask.current = undefined;
      setUser(null);
      setUsers([]);
      setNotifications([]);
    }

    const revision = ++sessionRevision.current;
    setSessionUnavailable(false);
    setLoading(Boolean(authUser));
    if (!authUser) return;

    // Run Supabase requests outside the auth listener's exclusive lock.
    profileTask.current = window.setTimeout(async () => {
      try {
        const profile = await loadSessionProfile(authUser);
        if (sessionRevision.current !== revision) return;
        if (!profile) throw new Error('Account profile unavailable');
        applyProfile(profile);
      } catch (error) {
        if (sessionRevision.current !== revision) return;
        if (isInvalidSessionError(error)) {
          console.warn('Clearing expired/invalid stored session:', error);
          clearLocalSupabaseSession();
          void supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
          sessionOwner.current = null;
          profileOwner.current = undefined;
          pendingProfile.current = undefined;
          setUser(null);
          setUsers([]);
          setNotifications([]);
          setSessionUnavailable(false);
          return;
        }
        console.error('Could not restore the account profile:', error);
        setSessionUnavailable(true);
      } finally {
        if (sessionRevision.current === revision) {
          profileTask.current = undefined;
          setLoading(false);
        }
      }
    }, 0);
  }, [applyProfile, loadSessionProfile]);

  const retrySession = useCallback(async () => {
    window.clearTimeout(profileTask.current);
    profileTask.current = undefined;
    pendingProfile.current = undefined;
    const revision = ++sessionRevision.current;
    const hadStoredToken = hasStoredSupabaseSession();
    setLoading(true);
    setSessionUnavailable(false);
    const timeout = window.setTimeout(() => {
      if (sessionRevision.current !== revision) return;
      sessionRevision.current++;
      // If there wasn't even a stored session token, treat timeout as cleanly signed out.
      if (!hadStoredToken) {
        syncSession(null);
        return;
      }
      setSessionUnavailable(true);
      setLoading(false);
    }, 12_000);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (sessionRevision.current !== revision) return;
      if (error) {
        if (isInvalidSessionError(error)) {
          console.warn('Clearing invalid Supabase session on restore:', error);
          clearLocalSupabaseSession();
          void supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
          syncSession(null);
          return;
        }
        throw error;
      }
      syncSession(data.session?.user ?? null);
    } catch (error) {
      if (sessionRevision.current !== revision) return;
      if (isInvalidSessionError(error) || !hadStoredToken) {
        clearLocalSupabaseSession();
        syncSession(null);
        return;
      }
      console.error('Could not restore the session:', error);
      setSessionUnavailable(true);
      setLoading(false);
    } finally {
      window.clearTimeout(timeout);
    }
  }, [syncSession]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') syncSession(session?.user ?? null);
    });
    void retrySession();
    return () => {
      sessionRevision.current++;
      window.clearTimeout(profileTask.current);
      profileTask.current = undefined;
      subscription.unsubscribe();
    };
  }, [retrySession, syncSession]);

  useEffect(() => {
    if (!sessionUnavailable) return;
    const reconnect = () => { void retrySession(); };
    window.addEventListener('online', reconnect);
    return () => window.removeEventListener('online', reconnect);
  }, [sessionUnavailable, retrySession]);

  const currentRefresh = useRef<{ id: string; request: Promise<void> }>();
  const refreshCurrentUser = useCallback(() => {
    const id = user?.id;
    if (!id) return Promise.resolve();
    if (currentRefresh.current?.id === id) return currentRefresh.current.request;
    const request = UserService.getUserById(id, AbortSignal.timeout(10_000)).then(
      (profile) => { if (profile) applyProfile(profile); },
      (error) => { console.error('Error refreshing current user:', error); },
    ).finally(() => {
      if (currentRefresh.current?.request === request) currentRefresh.current = undefined;
    });
    currentRefresh.current = { id, request };
    return request;
  }, [user?.id, applyProfile]);

  // Real-time subscription for profile and notifications updates
  useEffect(() => {
    if (!user?.id) return;
    const id = user.id;
    void fetchNotificationsForUser(id);
    let connected = false;
    let syncing = false;
    let lastSync = 0;

    const syncVisibleData = (wake = false) => {
      if (syncing || sessionOwner.current !== id || document.visibilityState !== 'visible' || !navigator.onLine) return;
      if (!wake && Date.now() - lastSync < (connected ? 30_000 : 8_000)) return;
      syncing = true;
      lastSync = Date.now();
      void Promise.allSettled([refreshCurrentUser(), fetchNotificationsForUser(id)]).finally(() => { syncing = false; });
    };
    const onWake = () => syncVisibleData(true);
    const onPush = (event: MessageEvent) => {
      if (event.data?.type === 'collectipay-payment-alert') onWake();
    };

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
          applyProfile(updatedProfile);
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
        (payload) => {
          if (payload.eventType === 'INSERT' && sessionOwner.current === id) {
            const notification = payload.new as NotificationRecord;
            if (notification.user_id === id) {
              recordNotifications(id, [notification], true);
              setNotifications((previous) => [notification, ...previous.filter((row) => row.id !== notification.id)].slice(0, 100));
            }
          }
          void fetchNotificationsForUser(id);
        }
      )
      .subscribe((status) => {
        connected = status === 'SUBSCRIBED';
        if (status !== 'CLOSED') onWake();
      });

    const timer = window.setInterval(() => syncVisibleData(), 8_000);
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('online', onWake);
    window.addEventListener('focus', onWake);
    navigator.serviceWorker?.addEventListener('message', onPush);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('online', onWake);
      window.removeEventListener('focus', onWake);
      navigator.serviceWorker?.removeEventListener('message', onPush);
      void supabase.removeChannel(channel);
    };
  }, [user?.id, applyProfile, fetchNotificationsForUser, recordNotifications, refreshCurrentUser]);

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

  const toggleNotificationRead = useCallback(async (notificationId: string, isRead: boolean) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: isRead } : n))
    );
    const ok = await NotificationService.setReadStatus(notificationId, isRead);
    if (!ok) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: !isRead } : n))
      );
    }
    return ok;
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    if (!user?.id) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await NotificationService.markAllAsRead(user.id);
  }, [user?.id]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    let removed: NotificationRecord | undefined;
    setNotifications((prev) => {
      removed = prev.find((n) => n.id === notificationId);
      return prev.filter((n) => n.id !== notificationId);
    });
    const ok = await NotificationService.deleteNotification(notificationId);
    if (!ok && removed) {
      const restore = removed;
      setNotifications((prev) => [restore, ...prev].sort(
        (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
      ));
    }
    return ok;
  }, []);

  const clearReadNotifications = useCallback(async () => {
    if (!user?.id) return false;
    let snapshot: NotificationRecord[] = [];
    setNotifications((prev) => {
      snapshot = prev;
      return prev.filter((n) => !n.is_read);
    });
    const ok = await NotificationService.clearReadNotifications(user.id);
    if (!ok) setNotifications(snapshot);
    return ok;
  }, [user?.id]);

  const clearAllNotifications = useCallback(async () => {
    if (!user?.id) return false;
    let snapshot: NotificationRecord[] = [];
    setNotifications((prev) => {
      snapshot = prev;
      return [];
    });
    const ok = await NotificationService.clearAllNotifications(user.id);
    if (!ok) setNotifications(snapshot);
    return ok;
  }, [user?.id]);

  const refreshUserData = useCallback(async () => {
    const id = user?.id;
    if (!id) return;
    await Promise.allSettled([
      refreshCurrentUser(),
      fetchNotificationsForUser(id),
      user.role === 'admin' && UserService.getUsers().then((profiles) => {
        if (sessionOwner.current === id) setUsers(profiles);
      }, (error) => console.error('Error loading admin users:', error)),
    ]);
  }, [user?.id, user?.role, refreshCurrentUser, fetchNotificationsForUser]);

  // Proper Supabase Auth signIn
  const signIn = async (email: string, password: string) => {
    try {
      // Cancel any stale/hung session restore so fresh sign-in takes clean ownership.
      window.clearTimeout(profileTask.current);
      profileTask.current = undefined;
      pendingProfile.current = undefined;
      sessionRevision.current++;
      setSessionUnavailable(false);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { error: { message: error.message }, profile: null };
      }

      let profile: Profile | null = null;
      if (data.user) {
        sessionOwner.current = data.user.id;
        profile = await loadSessionProfile(data.user);
        if (!profile) {
          return { error: { message: 'Could not load your account profile. Please try again.' }, profile: null };
        }
        if (sessionOwner.current === data.user.id) {
          applyProfile(profile);
          setLoading(false);
        }
      }

      return { error: null, profile };
    } catch (error: any) {
      return { error: { message: error?.message || 'Login failed' }, profile: null };
    }
  };

  const signUp = async (email: string, password: string, metadata: { name: string; phone?: string }) => {
    const issue = passwordIssue(password);
    if (issue) return { error: { message: issue } };
    const phone = normalizeSignupPhone(metadata.phone);
    if (!phone) return { error: { message: SIGNUP_PHONE_ERROR } };
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: metadata.name,
            phone,
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
    applyProfile(updatedUser);
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
    const hadBrokenSession = sessionUnavailable || (!user && loading) || !navigator.onLine;
    // Immediately clear React auth state and cancel any stuck restore tasks so UI responds instantly.
    sessionRevision.current++;
    window.clearTimeout(profileTask.current);
    profileTask.current = undefined;
    pendingProfile.current = undefined;
    currentRefresh.current = undefined;
    sessionOwner.current = null;
    seenNotifications.current = undefined;
    notificationFetchVersion.current++;
    profileOwner.current = undefined;
    setUser(null);
    setUsers([]);
    setNotifications([]);
    setSessionUnavailable(false);
    setLoading(false);

    if (hadBrokenSession) {
      // Wipe stale/corrupted tokens right away so even an immediate reload recovers cleanly.
      clearLocalSupabaseSession();
      void Promise.race([
        supabase.auth.signOut({ scope: 'local' }).catch(() => undefined),
        new Promise<void>((resolve) => window.setTimeout(resolve, 1000)),
      ]);
      return;
    }

    // Best-effort remote push/session cleanup capped at 1.5s so sign-out can never hang.
    await Promise.race([
      Promise.allSettled([
        disablePush().catch(() => undefined),
        supabase.auth.signOut().catch((error) => {
          console.error('Error logging out:', error);
        }),
      ]),
      new Promise<void>((resolve) => window.setTimeout(resolve, 1500)),
    ]);

    // Guarantee dead/stale tokens are removed locally even if network or server sign-out timed out.
    clearLocalSupabaseSession();
    void Promise.race([
      supabase.auth.signOut({ scope: 'local' }).catch(() => undefined),
      new Promise<void>((resolve) => window.setTimeout(resolve, 1000)),
    ]);
  };

  return (
    <SupabaseUserContext.Provider
      value={{
        user,
        users,
        notifications: visibleNotifications,
        unreadNotificationCount,
        isAdmin,
        isAuthenticated,
        loading,
        sessionUnavailable,
        retrySession,
        refreshUserData,
        refreshCurrentUser,
        refreshNotifications,
        markNotificationRead,
        toggleNotificationRead,
        markAllNotificationsRead,
        deleteNotification,
        clearReadNotifications,
        clearAllNotifications,
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
