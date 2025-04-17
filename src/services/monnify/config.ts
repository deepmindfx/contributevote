
// Base configuration for Monnify API

export const BASE_URL = 'https://api.monnify.com';
export const API_KEY = "MK_PROD_XR897H4H43";
export const SECRET_KEY = "GPFCA9GTP81DYJGF9VMAPRK220SS6CK9";
export const CONTRACT_CODE = "465595618981";

/**
 * Encode API credentials for Basic Auth
 */
export const getEncodedCredentials = (): string => {
  return btoa(`${API_KEY}:${SECRET_KEY}`);
};
