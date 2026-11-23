import { EdgeFunctionService } from '@/services/supabase/edgeFunctionService';

interface VirtualAccountParams {
  email: string;
  amount?: number;
  tx_ref: string;
  bvn: string;
  narration?: string;
}

/**
 * Create a virtual account for a customer via Supabase Edge Function
 */
export const createVirtualAccount = async (data: VirtualAccountParams) => {
  try {
    const result = await EdgeFunctionService.createVirtualAccount({
      email: data.email,
      tx_ref: data.tx_ref,
      bvn: data.bvn,
      narration: data.narration || `Virtual account for ${data.email}`,
    });

    if (!result?.success || !result?.data) {
      return {
        success: false,
        message: result?.error || 'Failed to create virtual account',
      };
    }

    return {
      success: true,
      responseBody: result.data,
    };
  } catch (error) {
    console.error('Error creating virtual account:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create virtual account. Please try again.',
    };
  }
};

/**
 * Verify a Flutterwave transaction server-side via Supabase Edge Function
 */
export const verifyTransaction = async (
  transactionId: string,
  options?: { tx_ref?: string; group_id?: string; anonymous?: boolean }
) => {
  try {
    const result = await EdgeFunctionService.verifyTransaction({
      transaction_id: transactionId,
      tx_ref: options?.tx_ref,
      group_id: options?.group_id,
      anonymous: options?.anonymous,
    });

    if (!result?.success) {
      return {
        success: false,
        message: result?.error || 'Transaction verification failed',
      };
    }

    return {
      success: true,
      responseBody: result.data,
      alreadyProcessed: result.alreadyProcessed,
    };
  } catch (error) {
    console.error('Error verifying transaction:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to verify transaction',
    };
  }
};

/**
 * Create a virtual account for a contribution group via Supabase Edge Function
 */
export const createGroupVirtualAccount = async (groupId: string) => {
  try {
    const result = await EdgeFunctionService.createVirtualAccount({ purpose: 'group', groupId });

    if (!result?.success || typeof result.data?.account_number !== 'string' || !/^\d{10}$/.test(result.data.account_number)) {
      return {
        success: false,
        message: result?.error || 'Failed to create virtual account',
        needsReview: result?.code === 'GROUP_BANK_REVIEW_REQUIRED',
      };
    }

    return {
      success: true,
      responseBody: result.data,
    };
  } catch (error) {
    console.error('Error creating group virtual account:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create virtual account. Please try again.',
    };
  }
};

export function groupBankSupportLink(groupId: string) {
  const subject = encodeURIComponent('CollectiPay group bank setup');
  const body = encodeURIComponent(`Please check bank setup for group ${groupId}.\nOriginal reference: GROUP_${groupId}_VA`);
  return `mailto:support@collectipay.com.ng?subject=${subject}&body=${body}`;
}
