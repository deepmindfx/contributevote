
import { BASE_URL, CONTRACT_CODE } from './config';
import { getAuthToken } from './auth';
import { 
  CreateReservedAccountRequest, 
  CreateGroupAccountRequest,
  MonnifyApiResponse,
  SimpleResponse
} from './types';

/**
 * Create a reserved account for a customer
 * @param data Account creation data
 * @returns Response with account details
 */
export const createReservedAccount = async (data: CreateReservedAccountRequest): Promise<MonnifyApiResponse | SimpleResponse> => {
  try {
    console.log("Creating reserved account with data:", data);
    
    // Get authentication token
    const token = await getAuthToken();
    if (!token) {
      console.error("Failed to authenticate with payment provider");
      return { success: false, message: "Failed to authenticate with payment provider" };
    }
    
    console.log("Sending account creation request...");
    const response = await fetch(`${BASE_URL}/api/v2/bank-transfer/reserved-accounts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error("Reserved account creation failed:", responseData);
      return { 
        success: false, 
        message: responseData.responseMessage || `Failed to create reserved account: ${response.status}`
      };
    }
    
    if (!responseData.requestSuccessful) {
      console.error("Reserved account creation failed with error:", responseData);
      return { 
        success: false, 
        message: responseData.responseMessage || "Failed to create reserved account" 
      };
    }
    
    console.log("Account creation successful:", responseData);
    return responseData;
  } catch (error) {
    console.error("Error creating reserved account:", error);
    return { success: false, message: "Unable to connect to payment provider" };
  }
};

/**
 * Create a reserved account for a contribution group
 * @param data Account creation data for the group
 * @returns Response with account details
 */
export const createContributionGroupAccount = async (data: CreateGroupAccountRequest): Promise<MonnifyApiResponse | SimpleResponse> => {
  try {
    // Format the account name to include CollectiPay prefix
    const formattedAccountName = data.accountName;
    console.log("Creating contribution group account with name:", formattedAccountName);
    
    // Use the same createReservedAccount function but with group-specific data
    const response = await createReservedAccount({
      ...data,
      // Use the provided group name as account name
      accountName: formattedAccountName,
      // Use the provided contractCode 
      contractCode: CONTRACT_CODE,
      preferredBanks: ["035"], // Use the same bank as personal accounts for consistency
      getAllAvailableBanks: true
    });
    
    return response;
  } catch (error) {
    console.error("Error creating contribution group account:", error);
    return { success: false, message: "Unable to create account for the contribution group" };
  }
};
