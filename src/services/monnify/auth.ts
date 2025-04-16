
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
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { message: errorText || "Unknown error" };
      }
      console.error("Authentication error details:", errorData);
      throw new Error(`Authentication failed: ${response.status} - ${errorData.message || response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.requestSuccessful || !data.responseBody?.accessToken) {
      console.error("Auth response missing token:", data);
      throw new Error("Invalid authentication response from server");
    }
    
    console.log("Authentication successful");
    return data.responseBody.accessToken;
  } catch (error) {
    console.error("Error getting auth token:", error);
    return null;
  }
};
