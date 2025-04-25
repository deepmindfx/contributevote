
import { v4 as uuidv4 } from 'uuid';
import { getEdgeFunctionUrl, getHeaders } from './config';

export interface VirtualAccountParams {
  email: string;
  firstname: string;
  lastname: string;
  bvn?: string;
  phonenumber?: string;
  is_permanent?: boolean;
  narration?: string;
}

export interface VirtualAccountResponse {
  status: string;
  message: string;
  data: {
    account_number: string;
    bank_name: string;
    order_ref: string;
    frequency: number;
    created_at: string;
    expiry_date: string;
    note: string;
    amount: number;
  };
}

export const createVirtualAccount = async (params: VirtualAccountParams) => {
  try {
    // Log params (masking sensitive data)
    console.log("Creating virtual account with params:", {
      ...params,
      bvn: params.bvn ? "****" : undefined,
      phonenumber: params.phonenumber ? "****" : undefined,
    });
    
    if (!params.email || !params.firstname || !params.lastname) {
      throw new Error("Email, firstname and lastname are required");
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(params.email)) {
      throw new Error("Invalid email format");
    }
    
    // Generate a unique reference
    const txRef = `VA_${uuidv4()}`;
    
    // Create the request payload according to Flutterwave docs
    const payload = {
      email: params.email,
      is_permanent: params.is_permanent === undefined ? true : params.is_permanent,
      bvn: params.bvn,
      tx_ref: txRef,
      firstname: params.firstname,
      lastname: params.lastname,
      phonenumber: params.phonenumber,
      narration: params.narration || `Virtual Account for ${params.firstname} ${params.lastname}`
    };
    
    console.log("Sending payload to Flutterwave:", {
      ...payload,
      email: payload.email,
      bvn: payload.bvn ? "****" : undefined,
      phonenumber: payload.phonenumber ? "****" : undefined
    });
    
    // Make the API request through our edge function
    const response = await fetch(getEdgeFunctionUrl('create-virtual-account'), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log("Edge function response:", data);

    if (!response.ok) {
      console.error("API Error Response:", data);
      throw new Error(data.message || 'Failed to create virtual account');
    }

    return {
      requestSuccessful: true,
      responseMessage: "Virtual account created successfully",
      responseBody: {
        accounts: [{
          accountNumber: data.data?.account_number,
          bankName: data.data?.bank_name
        }],
        accountReference: data.data?.order_ref,
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
    if (!params.bvn) {
      console.error("BVN is required for creating group virtual accounts");
      return {
        requestSuccessful: false,
        responseMessage: "BVN is required for creating group virtual accounts",
        responseBody: null
      };
    }

    const result = await createVirtualAccount({
      ...params,
      is_permanent: true,
      narration: params.narration || `Group Account for ${params.firstname} ${params.lastname}`
    });

    return result;
  } catch (error) {
    console.error("Error creating group virtual account:", error);
    return {
      requestSuccessful: false,
      responseMessage: error instanceof Error ? error.message : "Failed to create group virtual account",
      responseBody: null
    };
  }
};
