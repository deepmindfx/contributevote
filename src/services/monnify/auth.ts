
import { BASE_URL, getEncodedCredentials } from './config';

/**
 * Get authentication token for API access
 * @returns Auth token for subsequent API calls
 */
export const getAuthToken = async () => {
  try {
    const credentials = getEncodedCredentials();
    
    console.log("Attempting to authenticate with Monnify...");
    
    const response = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      }
    });
    
    const responseText = await response.text();
    
    try {
      const data = JSON.parse(responseText);
      
      if (!response.ok) {
        console.error("Authentication failed with status:", response.status);
        console.error("Response text:", responseText);
        throw new Error(`Authentication failed: ${response.status} - ${data.responseMessage || ''}`);
      }
      
      if (!data.requestSuccessful || !data.responseBody?.accessToken) {
        console.error("Auth response missing token:", data);
        throw new Error("Invalid authentication response from server");
      }
      
      console.log("Authentication successful with Monnify");
      return data.responseBody.accessToken;
    } catch (e) {
      if (e instanceof SyntaxError) {
        // This is a JSON parsing error
        console.error("Failed to parse authentication response as JSON:", responseText);
        throw new Error(`Authentication failed: ${response.status} - Invalid response format`);
      }
      throw e; // Re-throw if it's not a parsing error
    }
  } catch (error) {
    console.error("Error getting auth token:", error);
    throw error; // Re-throw to handle in the calling function
  }
};
