// Base configuration for Flutterwave API
export const BASE_URL = 'http://localhost:8082/api/flutterwave';  // Local proxy URL
// Do NOT export secret keys or use process.env here; only use secrets in server-side code (API routes)
export const PUBLIC_KEY = 'FLWPUBK-c8219c2937991e7d7db1652def38e630-X';
export const ENCRYPTION_KEY = '85d93895f84a288eebd6f33c';

// Validate API credentials (only for public keys)
if (!PUBLIC_KEY || !ENCRYPTION_KEY) {
  console.error('Flutterwave API credentials are not properly configured');
  throw new Error('Flutterwave API credentials are missing');
}

// Validate API key format (only for public keys)
if (!PUBLIC_KEY.startsWith('FLWPUBK-')) {
  console.error('Invalid Flutterwave API key format');
  throw new Error('Invalid Flutterwave API key format');
}

// Log configuration (without sensitive data)
console.log('Flutterwave API Configuration:', {
  baseUrl: BASE_URL,
  hasPublicKey: !!PUBLIC_KEY,
  hasEncryptionKey: !!ENCRYPTION_KEY
}); 