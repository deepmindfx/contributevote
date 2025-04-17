
// Base configuration for Monnify API

// Use the live URL for production
export const BASE_URL = 'https://api.monnify.com';

// Use the API key and secret key provided by Monnify
export const API_KEY = "MK_PROD_XR897H4H43";
export const SECRET_KEY = "GPFCA9GTP81DYJGF9VMAPRK220SS6CK9";
export const CONTRACT_CODE = "465595618981";

/**
 * Encode API credentials for Basic Auth
 */
export const getEncodedCredentials = (): string => {
  try {
    // For Basic Auth, encode "API_KEY:SECRET_KEY" in base64
    const str = `${API_KEY}:${SECRET_KEY}`;
    
    // Standard btoa encoding (works for ASCII characters)
    // Using a more robust encoding method for wider character support
    return btoa(str);
  } catch (error) {
    console.error("Error encoding credentials:", error);
    throw new Error("Failed to encode authentication credentials");
  }
};
