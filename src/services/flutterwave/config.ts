
// Base configuration for Flutterwave API - use Supabase Edge Function to avoid CORS issues

// When using the edge function, we don't need the actual API keys in the frontend code
export const API_KEY = 'Using-Supabase-Edge-Function';
export const PUBLIC_KEY = 'FLWPUBK-c8219c2937991e7d7db1652def38e630-X';
export const ENCRYPTION_KEY = '85d93895f84a288eebd6f33c';

/**
 * Get the base URL for the Flutterwave API via our Supabase Edge Function
 */
export const getEdgeFunctionUrl = (endpoint: string) => {
  return `https://nvinapqmcmbpyjpwpgms.supabase.co/functions/v1/flutterwave-api/${endpoint}`;
};

/**
 * Generate headers for API requests to our edge function
 */
export const getHeaders = () => ({
  'Content-Type': 'application/json'
});
