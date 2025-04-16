
// Base configuration for Monnify API

// Use the sandbox URL for testing
export const BASE_URL = 'https://sandbox.monnify.com';
export const API_KEY = "MK_TEST_SAF7HR5F3F";
export const SECRET_KEY = "4ENM8YPJKUAWYBYGVS4NQCKF3PN7X2JV";
export const CONTRACT_CODE = "465595618981";

/**
 * Encode API credentials for Basic Auth
 */
export const getEncodedCredentials = (): string => {
  return btoa(`${API_KEY}:${SECRET_KEY}`);
};
