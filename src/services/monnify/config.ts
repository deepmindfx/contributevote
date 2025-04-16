
// Base configuration for Monnify API

// Use the live URL for production
export const BASE_URL = 'https://api.monnify.com';
export const API_KEY = "MK_PROD_YDQW9Y37QK";
export const SECRET_KEY = "F3BWRYFTS4E3AECEGXTRMM47HSMCQH8H";
export const CONTRACT_CODE = "465595618981";

/**
 * Encode API credentials for Basic Auth
 */
export const getEncodedCredentials = (): string => {
  // Make sure we're using the correct encoding for the credentials
  // Some browsers might have issues with btoa directly, so we handle potential Unicode issues
  try {
    // For Basic Auth, encode "API_KEY:SECRET_KEY" in base64
    const str = `${API_KEY}:${SECRET_KEY}`;
    
    // Handle Unicode characters properly
    let utf8Str = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    });
    
    return btoa(utf8Str);
  } catch (error) {
    console.error("Error encoding credentials:", error);
    // Fallback to standard encoding
    return btoa(`${API_KEY}:${SECRET_KEY}`);
  }
};
