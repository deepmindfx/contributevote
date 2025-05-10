// Base configuration for Flutterwave API
export const BASE_URL = '/api/flutterwave';  // Using proxy URL
export const SECRET_KEY = 'FLWSECK-85d93895f84a5bd92b7fbad3e211fd76-1965a626b3cvt-X';
export const PUBLIC_KEY = 'FLWPUBK-c8219c2937991e7d7db1652def38e630-X';
export const ENCRYPTION_KEY = '85d93895f84a288eebd6f33c';

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
  baseUrl: BASE_URL,
  hasSecretKey: !!SECRET_KEY,
  hasPublicKey: !!PUBLIC_KEY,
  hasEncryptionKey: !!ENCRYPTION_KEY
}); 