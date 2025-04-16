
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
  return btoa(`${API_KEY}:${SECRET_KEY}`);
};
