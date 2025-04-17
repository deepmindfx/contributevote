
import { BASE_URL } from './config';
import { getAuthToken } from './auth';
import { MonnifyApiResponse, SimpleResponse, MonnifyTransactionResponse } from './types';

/**
 * Get reserved account details
 * @param accountReference Account reference
 * @returns Response with account details
 */
export const getReservedAccountDetails = async (accountReference: string): Promise<MonnifyApiResponse | SimpleResponse> => {
  try {
    console.log("Getting reserved account details for:", accountReference);
    
    // Get authentication token
    const token = await getAuthToken();
    if (!token) {
      console.error("Failed to authenticate with payment provider");
      return { success: false, message: "Failed to authenticate with payment provider" };
    }
    
    console.log("Sending request for account details...");
    const response = await fetch(`${BASE_URL}/api/v2/bank-transfer/reserved-accounts/${accountReference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error("Failed to get account details:", responseData);
      return { 
        success: false, 
        message: responseData.responseMessage || `Failed to get reserved account details: ${response.status}` 
      };
    }
    
    if (!responseData.requestSuccessful) {
      console.error("Account details request failed:", responseData);
      return { 
        success: false, 
        message: responseData.responseMessage || "Failed to get reserved account details" 
      };
    }
    
    console.log("Account details retrieved successfully");
    return responseData;
  } catch (error) {
    console.error("Error getting reserved account details:", error);
    return { success: false, message: "Unable to connect to payment provider" };
  }
};

/**
 * Get reserved account transactions
 * @param accountReference Account reference
 * @returns Response with transactions
 */
export const getReservedAccountTransactions = async (accountReference: string): Promise<MonnifyApiResponse<MonnifyTransactionResponse>> => {
  try {
    console.log("Getting reserved account transactions for:", accountReference);
    
    // Get authentication token
    const token = await getAuthToken();
    if (!token) {
      console.error("Failed to authenticate with payment provider");
      return { 
        requestSuccessful: false, 
        responseMessage: "Failed to authenticate with payment provider",
        responseCode: "401",
        responseBody: { content: [], totalElements: 0, totalPages: 0, hasNext: false, hasPrevious: false } 
      };
    }
    
    console.log("Sending request for transactions...");
    const response = await fetch(`${BASE_URL}/api/v1/bank-transfer/reserved-accounts/transactions?accountReference=${accountReference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error("Failed to get transactions:", responseData);
      return { 
        requestSuccessful: false, 
        responseMessage: responseData.responseMessage || `Failed to get reserved account transactions: ${response.status}`,
        responseCode: response.status.toString(),
        responseBody: { content: [], totalElements: 0, totalPages: 0, hasNext: false, hasPrevious: false } 
      };
    }
    
    if (!responseData.requestSuccessful) {
      console.error("Transactions request failed:", responseData);
      return { 
        requestSuccessful: false, 
        responseMessage: responseData.responseMessage || "Failed to get transactions",
        responseCode: responseData.responseCode || "500",
        responseBody: { content: [], totalElements: 0, totalPages: 0, hasNext: false, hasPrevious: false } 
      };
    }
    
    console.log("Transactions retrieved successfully:", 
      responseData.responseBody?.content?.length || 0, "transactions found");
    return responseData;
  } catch (error) {
    console.error("Error getting reserved account transactions:", error);
    // Return an empty successful response instead of error to prevent UI disruption
    return { 
      requestSuccessful: false, 
      responseMessage: "Failed to fetch transactions. Please try again.",
      responseCode: "500",
      responseBody: { content: [], totalElements: 0, totalPages: 0, hasNext: false, hasPrevious: false } 
    };
  }
};
