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
    console.log("Creating virtual account with data:", {
      ...data,
      bvn: '****' + data.bvn.slice(-4) // Mask BVN for security
    });
    
    const requestBody = {
      email: data.email,
      is_permanent: true,
      bvn: data.bvn,
      tx_ref: data.tx_ref,
      narration: data.narration || `Virtual account for ${data.email}`,
      currency: "NGN",
      amount: data.amount || 0
    };
    
    console.log("Request URL:", `${BASE_URL}/virtual-account-numbers`);
    console.log("Request headers:", {
      'Authorization': 'Bearer ****' + SECRET_KEY.slice(-10),
      'Content-Type': 'application/json'
    });
    
    const response = await fetch(`${BASE_URL}/virtual-account-numbers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log("Response status:", response.status);
    console.log("Response headers:", Object.fromEntries(response.headers.entries()));
    
    // Log raw response for debugging
    const responseText = await response.text();
    console.log("Raw response:", responseText);
    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse response:", {
        error: parseError,
        responseText: responseText.substring(0, 200) + '...' // Log first 200 chars
      });
      return {
        success: false,
        message: "Invalid response format from Flutterwave"
      };
    }
    
    if (!response.ok || responseData.status === 'error') {
      console.error("API error response:", {
        status: response.status,
        statusText: response.statusText,
        data: responseData
      });
      
      // Handle specific error cases
      if (response.status === 401) {
        return {
          success: false,
          message: "Invalid API key or authentication failed"
        };
      }
      
      if (response.status === 400) {
        return {
          success: false,
          message: responseData.message || "Invalid request parameters"
        };
      }
      
      return { 
        success: false, 
        message: responseData.message || `Failed to create virtual account: ${response.status}`
      };
    }
    
    console.log("Success response:", responseData);
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
    
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      return {
        success: false,
        message: "Network error: Unable to connect to Flutterwave API"
      };
    }
    
    return { 
      success: false, 
      message: "Failed to create virtual account. Please try again."
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