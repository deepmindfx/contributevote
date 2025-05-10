// Base configuration for Flutterwave API
const isProduction = import.meta.env.PROD;

// Use proxy in both development and production to handle CORS
export const BASE_URL = '/api/flutterwave';

// Use environment variables for API keys
export const SECRET_KEY = isProduction
  ? import.meta.env.VITE_FLW_SECRET_KEY_PROD
  : import.meta.env.VITE_FLW_SECRET_KEY_TEST;

export const PUBLIC_KEY = isProduction
  ? import.meta.env.VITE_FLW_PUBLIC_KEY_PROD
  : import.meta.env.VITE_FLW_PUBLIC_KEY_TEST;

export const ENCRYPTION_KEY = isProduction
  ? import.meta.env.VITE_FLW_ENCRYPTION_KEY_PROD
  : import.meta.env.VITE_FLW_ENCRYPTION_KEY_TEST;

// Validate API credentials
if (!SECRET_KEY || !PUBLIC_KEY || !ENCRYPTION_KEY) {
  console.error('Flutterwave API credentials are not properly configured');
  throw new Error('Flutterwave API credentials are missing');
}

// Validate API key format
if (!SECRET_KEY.startsWith('FLWSECK-') || !PUBLIC_KEY.startsWith('FLWPUBK-')) {
  console.error('Invalid Flutterwave API key format');
  throw new Error('Invalid Flutterwave API key format');
}

// Log configuration (without sensitive data)
console.log('Flutterwave API Configuration:', {
  environment: isProduction ? 'Production' : 'Development',
  baseUrl: BASE_URL,
  hasSecretKey: !!SECRET_KEY,
  hasPublicKey: !!PUBLIC_KEY,
  hasEncryptionKey: !!ENCRYPTION_KEY
}); 