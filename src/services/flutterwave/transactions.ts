
import { PUBLIC_KEY, SECRET_KEY, BASE_URL } from './config';

/**
 * Verify a transaction with Flutterwave
 * @param txRef The transaction reference
 * @returns Promise<{ success: boolean, data?: any, message?: string }>
 */
export const verifyTransaction = async (txRef: string) => {
  try {
    console.log(`Verifying transaction with reference: ${txRef}`);
    
    // First try to verify using the transaction reference endpoint
    const response = await fetch(`${BASE_URL}/transactions/verify_by_reference?tx_ref=${txRef}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SECRET_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    
    const responseData = await response.json();
    
    if (response.ok && responseData.status === 'success') {
      console.log('Transaction verification successful:', responseData);
      return {
        success: true,
        data: responseData.data
      };
    }
    
    // If verification failed, log the error
    console.error('Transaction verification failed:', responseData);
    return {
      success: false,
      message: responseData.message || 'Transaction verification failed',
      data: responseData
    };
  } catch (error) {
    console.error('Error verifying transaction:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error verifying transaction'
    };
  }
};

/**
 * Create a new transaction (e.g., for tests and simulations)
 */
export const createTestTransaction = async (data: any) => {
  try {
    console.log('Creating test transaction:', data);
    
    // Mock transaction logic
    // In a real implementation, this would interact with the Flutterwave API
    
    return {
      success: true,
      data: {
        ...data,
        id: `test_tx_${Date.now()}`,
        created_at: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error creating test transaction:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error creating transaction'
    };
  }
};
