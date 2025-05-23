import { BASE_URL, SECRET_KEY } from './config';

interface TransactionVerificationResponse {
  success: boolean;
  message?: string;
  data?: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    amount: number;
    currency: string;
    status: string;
    payment_type: string;
    created_at: string;
    customer: {
      id: number;
      name: string;
      email: string;
      phone_number: string | null;
    };
  };
}

/**
 * Verify a transaction with Flutterwave
 * @param tx_ref The transaction reference to verify
 * @returns The verification result
 */
export const verifyTransaction = async (tx_ref: string): Promise<TransactionVerificationResponse> => {
  try {
    console.log('Verifying transaction:', tx_ref);

    const response = await fetch(`${BASE_URL}/transactions/${tx_ref}/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Transaction verification failed:', {
        status: response.status,
        statusText: response.statusText
      });
      return {
        success: false,
        message: `Verification failed: ${response.statusText}`
      };
    }

    const data = await response.json();

    if (data.status === 'error') {
      console.error('API error response:', data);
      return {
        success: false,
        message: data.message || 'Verification failed'
      };
    }

    return {
      success: true,
      data: data.data
    };
  } catch (error) {
    console.error('Error verifying transaction:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}; 