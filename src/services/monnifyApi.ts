
// Compatibility layer for existing code that references monnifyApi
// This forwards calls to the Flutterwave implementation

import { createGroupVirtualAccount as flutterwaveCreateGroupAccount } from './flutterwave/virtualAccounts';

// Takes Monnify style parameters and converts them to Flutterwave style
export const createContributionGroupAccount = async (params: any) => {
  try {
    console.log("Forwarding to Flutterwave API:", params);
    
    const response = await flutterwaveCreateGroupAccount({
      email: params.customerEmail,
      name: params.accountName,
      bvn: params.customerBvn,
      isPermanent: true,
      narration: `Please make a bank transfer to ${params.accountName} Contribution Group`
    });
    
    console.log("Response from Flutterwave:", response);
    return response;
  } catch (error) {
    console.error("Error in compatibility layer:", error);
    return {
      requestSuccessful: false,
      responseMessage: error instanceof Error ? error.message : "Failed to create group virtual account",
      responseBody: null
    };
  }
};
