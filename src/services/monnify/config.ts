
// Base configuration for Monnify API

// Use the live URL for production
export const BASE_URL = 'https://api.monnify.com';

// Use the API key and secret key provided by Monnify
export const API_KEY = "MK_TEST_SAF7HR5F3F";
export const SECRET_KEY = "TYHGDJK734AHJSGTW63NNDVEUIOEP9K5";
export const CONTRACT_CODE = "465595618981";

/**
 * Encode API credentials for Basic Auth
 */
export const getEncodedCredentials = (): string => {
  try {
    // For Basic Auth, encode "API_KEY:SECRET_KEY" in base64
    const str = `${API_KEY}:${SECRET_KEY}`;
    
    // Standard btoa encoding (works for ASCII characters)
    return btoa(str);
  } catch (error) {
    console.error("Error encoding credentials:", error);
    throw new Error("Failed to encode authentication credentials");
  }
};
