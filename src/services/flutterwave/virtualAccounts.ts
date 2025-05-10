import { BASE_URL, SECRET_KEY } from './config';
import { toast } from 'sonner';

interface VirtualAccountParams {
  email: string;
  amount?: number;
  tx_ref: string;
  bvn: string;
  narration?: string;
}

/**
 * Create a virtual account for a customer
 * @param data Account creation data
 * @returns Response with account details
 */
export const createVirtualAccount = async (data: VirtualAccountParams) => {
  try {
    console.log("Creating virtual account with data:", data);
    
    const requestBody = {
      email: data.email,
      currency: "NGN",
      amount: data.amount || 0,
      tx_ref: data.tx_ref,
      is_permanent: true,
      narration: data.narration || "Please make a bank transfer",
      bvn: data.bvn
    };
    
    console.log("Request body:", requestBody);
    console.log("Using API URL:", `${BASE_URL}/virtual-account-numbers`);
    
    const response = await fetch(`${BASE_URL}/virtual-account-numbers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SECRET_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      mode: 'cors',
      credentials: 'omit',
      body: JSON.stringify(requestBody)
    });
    
    console.log("Response status:", response.status);
    console.log("Response headers:", Object.fromEntries(response.headers.entries()));
    
    const responseData = await response.json();
    console.log("Response data:", responseData);
    
    if (!response.ok) {
      console.error("Virtual account creation failed:", {
        status: response.status,
        statusText: response.statusText,
        data: responseData
      });
      return { 
        success: false, 
        message: responseData.message || `Failed to create virtual account: ${response.status}`
      };
    }
    
    if (responseData.status !== 'success') {
      console.error("Virtual account creation failed with error:", {
        status: responseData.status,
        message: responseData.message,
        data: responseData
      });
      return { 
        success: false, 
        message: responseData.message || "Failed to create virtual account" 
      };
    }
    
    console.log("Account creation successful:", responseData);
    return {
      success: true,
      responseBody: responseData.data
    };
  } catch (error) {
    console.error("Error creating virtual account:", {
      error,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    });

    // Handle specific network errors
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      return {
        success: false,
        message: "Network error: Unable to connect to Flutterwave. Please check your internet connection."
      };
    }

    return { 
      success: false, 
      message: error instanceof Error ? error.message : "Unable to connect to payment provider" 
    };
  }
};

/**
 * Verify a virtual account transaction
 * @param transactionId The Flutterwave transaction reference
 * @returns Transaction details if successful
 */
export const verifyTransaction = async (transactionId: string) => {
  try {
    console.log("Verifying transaction:", transactionId);
    
    const response = await fetch(`${BASE_URL}/transactions/${transactionId}/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SECRET_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    const responseData = await response.json();
    console.log("Verification response:", responseData);
    
    if (!response.ok) {
      console.error("Transaction verification failed:", responseData);
      return {
        success: false,
        message: responseData.message || "Failed to verify transaction"
      };
    }
    
    if (responseData.status !== 'success') {
      console.error("Transaction verification failed:", responseData);
      return {
        success: false,
        message: responseData.message || "Transaction verification failed"
      };
    }
    
    return {
      success: true,
      responseBody: responseData.data
    };
  } catch (error) {
    console.error("Error verifying transaction:", error);
    return {
      success: false,
      message: "Failed to verify transaction"
    };
  }
}; 