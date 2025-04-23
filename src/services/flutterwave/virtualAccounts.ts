
import { v4 as uuidv4 } from 'uuid';
import { getEdgeFunctionUrl, getHeaders } from './config';

export const createVirtualAccount = async (params: {
  email: string;
  name: string;
  bvn?: string;
  nin?: string;
  amount?: number;
  isPermanent?: boolean;
  narration?: string;
}) => {
  try {
    console.log("Creating virtual account with params:", params);
    
    // For real API call, we need to ensure BVN or NIN is provided for permanent accounts
    if (params.isPermanent && !params.bvn && !params.nin) {
      console.error("BVN or NIN is required for permanent accounts");
      return {
        requestSuccessful: false,
        responseMessage: "BVN or NIN is required for permanent accounts",
        responseBody: null
      };
    }
    
    // Generate a unique reference
    const txRef = `VA_${uuidv4()}`;
    
    // Create the request payload
    const payload = {
      email: params.email,
      is_permanent: params.isPermanent === undefined ? true : params.isPermanent,
      bvn: params.bvn,
      nin: params.nin,
      tx_ref: txRef,
      narration: params.narration || `Please make a bank transfer to ${params.name}`,
      currency: "NGN",
      ...(params.amount && { amount: params.amount })
    };
    
    console.log("Sending payload to Flutterwave through edge function:", payload);
    
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

export const createGroupVirtualAccount = async (params: {
  email: string;
  name: string;
  bvn?: string;
  nin?: string;
  amount?: number;
}) => {
  try {
    // Make sure we pass through the BVN/NIN provided by the user
    console.log("Creating group virtual account with ID:", params.bvn || params.nin);
    
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
