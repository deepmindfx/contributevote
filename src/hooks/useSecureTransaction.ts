import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { validateTransactionAmount, logSecurityEvent, createRateLimiter } from '@/lib/security';
import { useSecureAuth } from '@/contexts/SecureAuthContext';

// Rate limiter: max 10 transactions per minute per user
const transactionRateLimit = createRateLimiter(10, 60 * 1000);

export function useSecureTransaction() {
  const { user } = useSecureAuth();
  const [loading, setLoading] = useState(false);

  const createSecureTransaction = async (transactionData: {
    type: 'deposit' | 'withdrawal' | 'transfer';
    amount: number;
    description: string;
    contribution_id?: string;
    metadata?: Record<string, any>;
  }) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setLoading(true);

    try {
      // Security validations
      if (!validateTransactionAmount(transactionData.amount)) {
        logSecurityEvent({
          type: 'transaction',
          action: 'invalid_amount_attempted',
          userId: user.id,
          details: { amount: transactionData.amount },
          severity: 'medium'
        });
        throw new Error('Invalid transaction amount');
      }

      // Rate limiting
      if (!transactionRateLimit(user.id)) {
        logSecurityEvent({
          type: 'transaction',
          action: 'rate_limit_exceeded',
          userId: user.id,
          severity: 'high'
        });
        throw new Error('Too many transactions. Please wait before trying again.');
      }

      // Check user's wallet balance for withdrawals/transfers
      if (transactionData.type === 'withdrawal' || transactionData.type === 'transfer') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('wallet_balance')
          .eq('id', user.id)
          .single();

        if (!profile || (profile.wallet_balance || 0) < transactionData.amount) {
          logSecurityEvent({
            type: 'transaction',
            action: 'insufficient_funds_attempted',
            userId: user.id,
            details: { 
              requested: transactionData.amount, 
              available: profile?.wallet_balance || 0 
            },
            severity: 'medium'
          });
          throw new Error('Insufficient funds');
        }
      }

      // Create transaction with security metadata
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          type: transactionData.type,
          amount: transactionData.amount,
          description: transactionData.description,
          contribution_id: transactionData.contribution_id,
          status: 'pending',
          metadata: {
            ...transactionData.metadata,
            ip_address: 'client_side', // In production, get from server
            user_agent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            security_check: 'passed'
          }
        })
        .select()
        .single();

      if (error) {
        logSecurityEvent({
          type: 'transaction',
          action: 'creation_failed',
          userId: user.id,
          details: { error: error.message },
          severity: 'high'
        });
        throw error;
      }

      logSecurityEvent({
        type: 'transaction',
        action: 'created_successfully',
        userId: user.id,
        details: { 
          transaction_id: data.id, 
          type: transactionData.type,
          amount: transactionData.amount 
        },
        severity: 'low'
      });

      return data;
    } finally {
      setLoading(false);
    }
  };

  const verifyTransaction = async (transactionId: string, pin: string) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      // Validate PIN format
      if (!/^\d{4}$/.test(pin)) {
        logSecurityEvent({
          type: 'transaction',
          action: 'invalid_pin_format',
          userId: user.id,
          severity: 'medium'
        });
        throw new Error('Invalid PIN format');
      }

      // Get user's stored PIN (in production, this should be hashed)
      const { data: profile } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .single();

      const storedPin = profile?.preferences?.pin;
      if (!storedPin) {
        throw new Error('PIN not set. Please set up your transaction PIN first.');
      }

      if (storedPin !== pin) {
        logSecurityEvent({
          type: 'transaction',
          action: 'incorrect_pin_attempted',
          userId: user.id,
          severity: 'high'
        });
        throw new Error('Incorrect PIN');
      }

      // Update transaction status
      const { data, error } = await supabase
        .from('transactions')
        .update({ 
          status: 'completed',
          metadata: supabase.sql`metadata || '{"verified_at": "${new Date().toISOString()}"}'`
        })
        .eq('id', transactionId)
        .eq('user_id', user.id) // Ensure user owns the transaction
        .select()
        .single();

      if (error) {
        logSecurityEvent({
          type: 'transaction',
          action: 'verification_failed',
          userId: user.id,
          details: { transaction_id: transactionId, error: error.message },
          severity: 'high'
        });
        throw error;
      }

      logSecurityEvent({
        type: 'transaction',
        action: 'verified_successfully',
        userId: user.id,
        details: { transaction_id: transactionId },
        severity: 'low'
      });

      return data;
    } catch (error) {
      throw error;
    }
  };

  return {
    createSecureTransaction,
    verifyTransaction,
    loading
  };
}