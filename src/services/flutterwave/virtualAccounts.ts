
import { v4 as uuidv4 } from 'uuid';
import { BASE_URL, getHeaders } from './config';

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
  amount?: number;
  bvn?: string;
  isPermanent?: boolean;
  narration?: string;
}

/**
 * Create a virtual account for a user
 */
export const createVirtualAccount = async (params: AccountCreationParams) => {
  try {
    console.log("Creating virtual account with Flutterwave...");

    const response = await fetch(`${BASE_URL}/virtual-account-numbers`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        email: params.email,
        currency: "NGN",
        amount: params.amount || 0,
        tx_ref: `VTU-${uuidv4()}`,
        is_permanent: params.isPermanent || false,
        narration: params.narration || `Please make a bank transfer to ${params.name}`,
        ...(params.bvn && params.isPermanent ? { bvn: params.bvn } : {})
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Flutterwave API error:", errorData);
      throw new Error(errorData.message || `Failed to create virtual account: ${response.status}`);
    }

    const data: VirtualAccountResponse = await response.json();

    // Transform response to match expected format
    return {
      requestSuccessful: data.status === 'success',
      responseMessage: data.message,
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

/**
 * Create a virtual account for a contribution group
 */
export const createGroupVirtualAccount = async (params: AccountCreationParams) => {
  try {
    // Use same function but with permanent account setting for groups
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

