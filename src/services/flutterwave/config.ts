
// Base configuration for Flutterwave API

export const BASE_URL = 'https://api.flutterwave.com/v3';
export const API_KEY = 'FLWSECK-85d93895f84a5bd92b7fbad3e211fd76-1965a626b3cvt-X';
export const PUBLIC_KEY = 'FLWPUBK-c8219c2937991e7d7db1652def38e630-X';
export const ENCRYPTION_KEY = '85d93895f84a288eebd6f33c';

/**
 * Generate headers for API requests
 */
export const getHeaders = () => ({
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json'
});
