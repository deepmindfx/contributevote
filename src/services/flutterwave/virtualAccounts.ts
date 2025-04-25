
import { v4 as uuidv4 } from 'uuid';
import { getEdgeFunctionUrl, getHeaders } from './config';

interface VirtualAccountResponse {
  status: string;
  message: string;
  data: {
    account_number: string;
    bank_name: string;
    note: string;
    flw_ref: string;
    order_ref: string;
  };
}

interface AccountCreationParams {
  email: string;
  name: string;
  bvn?: string;
  amount?: number;
  isPermanent?: boolean;
  narration?: string;
}

export const createVirtualAccount = async (params: AccountCreationParams) => {
  try {
    console.log("Creating virtual account with params:", {
      email: params.email,
      name: params.name,
      bvn: params.bvn ? "****" : undefined, // Mask BVN in logs
      isPermanent: params.isPermanent,
      narration: params.narration
    });
    
    // For real API call, we need to ensure BVN is provided for permanent accounts
    if (params.isPermanent && !params.bvn) {
      console.log("No BVN provided for permanent account - this might cause issues with the Flutterwave API");
    }
    
    // Generate a unique reference
    const txRef = `VA_${uuidv4()}`;
    
    // Create the request payload
    const payload = {
      email: params.email,
      is_permanent: params.isPermanent === undefined ? true : params.isPermanent,
      bvn: params.bvn,
      tx_ref: txRef,
      narration: params.narration || `Please make a bank transfer to ${params.name}`,
      currency: "NGN",
      ...(params.amount && { amount: params.amount })
    };
    
    console.log("Sending payload to Flutterwave through edge function:", {
      ...payload,
      email: payload.email, // Show full email for debugging
      bvn: payload.bvn ? "****" : undefined // Mask BVN in logs
    });
    
    // Make the API request through our edge function
    const response = await fetch(getEdgeFunctionUrl('create-virtual-account'), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });

    // Get the response as JSON
    const data = await response.json();
    console.log("Edge function response:", data);

    if (!response.ok) {
      console.error("API Error Response:", data);
      throw new Error(data.message || 'Failed to create virtual account');
    }

    // If successful, format the response to match expected format
    return {
      requestSuccessful: true,
      responseMessage: data.message || "Virtual account created successfully",
      responseBody: {
        accounts: [{
          accountNumber: data.data?.account_number,
          bankName: data.data?.bank_name
        }],
        accountReference: data.data?.flw_ref,
        accountName: params.name
      }
    };
  } catch (error) {
    console.error("Error creating virtual account:", error);
    
    return {
      requestSuccessful: false,
      responseMessage: error instanceof Error ? error.message : "Failed to create virtual account",
      responseBody: null
    };
  }
};

export const createGroupVirtualAccount = async (params: AccountCreationParams) => {
  try {
    // Make sure BVN is included for permanent group accounts
    if (!params.bvn) {
      console.error("BVN is required for creating group virtual accounts");
      return {
        requestSuccessful: false,
        responseMessage: "BVN is required for creating group virtual accounts",
        responseBody: null
      };
    }

    console.log("Creating group virtual account with BVN:", params.bvn ? "****" : "Not provided");
    
    // Create permanent account for groups
    return await createVirtualAccount({
      ...params,
      isPermanent: true,
      narration: `Please make a bank transfer to ${params.name} Contribution Group`
    });
  } catch (error) {
    console.error("Error creating group virtual account:", error);
    return {
      requestSuccessful: false,
      responseMessage: error instanceof Error ? error.message : "Failed to create group virtual account",
      responseBody: null
    };
  }
};
