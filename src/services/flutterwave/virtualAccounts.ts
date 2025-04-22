
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
  bvn?: string;
  amount?: number;
  isPermanent?: boolean;
  narration?: string;
}

export const createVirtualAccount = async (params: AccountCreationParams) => {
  try {
    const response = await fetch(`${BASE_URL}/virtual-account-numbers`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        email: params.email,
        is_permanent: params.isPermanent || true,
        bvn: params.bvn,
        tx_ref: `VA_${uuidv4()}`,
        narration: params.narration || `Please make a bank transfer to ${params.name}`,
        currency: "NGN",
        ...(params.amount && { amount: params.amount })
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create virtual account');
    }

    const data = await response.json();

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

export const createGroupVirtualAccount = async (params: AccountCreationParams) => {
  // Make sure BVN is included for permanent group accounts
  if (!params.bvn) {
    throw new Error("BVN is required for creating group virtual accounts");
  }

  try {
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
