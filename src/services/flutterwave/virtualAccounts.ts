
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

export interface VirtualAccountParams {
  email: string;
  firstname: string;
  lastname: string;
  bvn?: string;
  amount?: number;
  isPermanent?: boolean;
  narration?: string;
  phonenumber?: string;
}

export const createVirtualAccount = async (params: VirtualAccountParams) => {
  try {
    console.log("Creating virtual account with params:", {
      ...params,
      bvn: params.bvn ? "****" + params.bvn.slice(-4) : undefined // Mask BVN for logs
    });
    
    // For real API call, we need to ensure BVN is provided for permanent accounts
    if (params.isPermanent && !params.bvn) {
      console.log("No BVN provided for permanent account - this might not work with the Flutterwave API");
    }
    
    // Generate a unique reference
    const txRef = `VA_${uuidv4()}`;
    
    // Create the request payload
    const payload = {
      email: params.email,
      is_permanent: params.isPermanent === undefined ? true : params.isPermanent,
      bvn: params.bvn,
      tx_ref: txRef,
      firstname: params.firstname,
      lastname: params.lastname,
      phonenumber: params.phonenumber,
      narration: params.narration || `Please make a bank transfer to ${params.firstname} ${params.lastname}`,
      currency: "NGN",
      ...(params.amount && { amount: params.amount })
    };
    
    console.log("Sending payload to Flutterwave through edge function:", {
      ...payload,
      bvn: payload.bvn ? "****" + payload.bvn.slice(-4) : undefined // Mask BVN for logs
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
      throw new Error(data.message || 'Failed to create virtual account');
    }

    // If successful, format the response to match expected format
    return {
      requestSuccessful: true,
      responseMessage: data.message || "Virtual account created successfully",
      responseBody: {
        accounts: [{
          accountNumber: data.data.account_number,
          bankName: data.data.bank_name
        }],
        accountReference: data.data.flw_ref,
        accountName: `${params.firstname} ${params.lastname}`
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

export const createGroupVirtualAccount = async (params: VirtualAccountParams) => {
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

    console.log("Creating group virtual account with BVN:", params.bvn ? "****" + params.bvn.slice(-4) : "none");
    
    // Create permanent account for groups
    return await createVirtualAccount({
      ...params,
      isPermanent: true,
      narration: `Please make a bank transfer to ${params.firstname} ${params.lastname} Contribution Group`
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
