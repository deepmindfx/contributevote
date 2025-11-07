import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { logSecurityEvent, validateEmail } from '@/lib/security';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, userData: { name: string; phone?: string }) => Promise<{ error?: any }>;
  signIn: (email: string, password: string) => Promise<{ error?: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: any }>;
  updateProfile: (data: { name?: string; phone?: string }) => Promise<{ error?: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function SecureAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Log security events
      logSecurityEvent({
        type: 'auth',
        action: event,
        userId: session?.user?.id,
        severity: event === 'SIGNED_OUT' ? 'low' : 'medium'
      });

      // Create or update profile when user signs up or signs in
      if (event === 'SIGNED_IN' && session?.user) {
        await ensureProfile(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const ensureProfile = async (user: User) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!profile) {
        // Create profile if it doesn't exist
        const { error } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
            phone: user.user_metadata?.phone,
            wallet_balance: 0,
            role: 'user',
            status: 'active',
            preferences: {
              darkMode: false,
              anonymousContributions: false,
              notificationsEnabled: true
            }
          });

        if (error) {
          logSecurityEvent({
            type: 'error',
            action: 'profile_creation_failed',
            userId: user.id,
            details: { error: error.message },
            severity: 'high'
          });
        }
      }
    } catch (error) {
      console.error('Error ensuring profile:', error);
    }
  };

  const signUp = async (email: string, password: string, userData: { name: string; phone?: string }) => {
    try {
      // Validate input
      if (!validateEmail(email)) {
        throw new Error('Invalid email format');
      }

      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: userData.name,
            phone: userData.phone,
          }
        }
      });

      if (error) {
        logSecurityEvent({
          type: 'auth',
          action: 'signup_failed',
          details: { email, error: error.message },
          severity: 'medium'
        });
        return { error };
      }

      logSecurityEvent({
        type: 'auth',
        action: 'signup_success',
        userId: data.user?.id,
        details: { email },
        severity: 'low'
      });

      return { error: null };
    } catch (error: any) {
      return { error: { message: error.message } };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      // Validate input
      if (!validateEmail(email)) {
        throw new Error('Invalid email format');
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        logSecurityEvent({
          type: 'auth',
          action: 'signin_failed',
          details: { email, error: error.message },
          severity: 'medium'
        });
        return { error };
      }

      logSecurityEvent({
        type: 'auth',
        action: 'signin_success',
        userId: data.user?.id,
        details: { email },
        severity: 'low'
      });

      return { error: null };
    } catch (error: any) {
      return { error: { message: error.message } };
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    
    if (!error) {
      logSecurityEvent({
        type: 'auth',
        action: 'signout_success',
        userId: user?.id,
        severity: 'low'
      });
    }
  };

  const resetPassword = async (email: string) => {
    try {
      if (!validateEmail(email)) {
        throw new Error('Invalid email format');
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        logSecurityEvent({
          type: 'auth',
          action: 'password_reset_failed',
          details: { email, error: error.message },
          severity: 'medium'
        });
        return { error };
      }

      logSecurityEvent({
        type: 'auth',
        action: 'password_reset_requested',
        details: { email },
        severity: 'low'
      });

      return { error: null };
    } catch (error: any) {
      return { error: { message: error.message } };
    }
  };

  const updateProfile = async (data: { name?: string; phone?: string }) => {
    try {
      if (!user) throw new Error('No user logged in');

      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', user.id);

      if (error) {
        logSecurityEvent({
          type: 'error',
          action: 'profile_update_failed',
          userId: user.id,
          details: { error: error.message },
          severity: 'medium'
        });
        return { error };
      }

      logSecurityEvent({
        type: 'access',
        action: 'profile_updated',
        userId: user.id,
        severity: 'low'
      });

      return { error: null };
    } catch (error: any) {
      return { error: { message: error.message } };
    }
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useSecureAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useSecureAuth must be used within a SecureAuthProvider');
  }
  return context;
}

// Alias for convenience (used by contribution components)
export const useAuth = useSecureAuth;