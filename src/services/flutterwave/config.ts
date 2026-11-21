// Base configuration for Flutterwave client-side integration
// NOTE: Secret keys MUST NEVER be bundled into client-side production builds.
// All authenticated Flutterwave API calls go through Supabase Edge Functions.

export const BASE_URL = '/api/flutterwave';

export const PUBLIC_KEY =
  import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY ||
  import.meta.env.VITE_FLW_PUBLIC_KEY_PROD ||
  import.meta.env.VITE_FLW_PUBLIC_KEY_TEST ||
  '';

// Deprecated client-side exports kept empty in production to avoid exposing secrets
export const SECRET_KEY = import.meta.env.DEV
  ? import.meta.env.VITE_FLW_SECRET_KEY_TEST || ''
  : '';

export const ENCRYPTION_KEY = import.meta.env.DEV
  ? import.meta.env.VITE_FLW_ENCRYPTION_KEY_TEST || ''
  : '';
