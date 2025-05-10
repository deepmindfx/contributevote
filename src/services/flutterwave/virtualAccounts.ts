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
    
    console.log("Sending account creation request...");
    const response = await fetch(`${BASE_URL}/virtual-account-numbers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error("Virtual account creation failed:", responseData);
      return { 
        success: false, 
        message: responseData.message || `Failed to create virtual account: ${response.status}`
      };
    }
    
    if (responseData.status !== 'success') {
      console.error("Virtual account creation failed with error:", responseData);
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
    console.error("Error creating virtual account:", error);
    return { success: false, message: "Unable to connect to payment provider" };
  }
}; 