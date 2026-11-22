// Base configuration for Flutterwave client-side integration
// NOTE: Secret keys MUST NEVER be bundled into client-side production builds.
// All authenticated Flutterwave API calls go through Supabase Edge Functions,
// which dynamically read live credentials from Super Admin -> Gateway Settings.

import { supabase } from '@/integrations/supabase/client';

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

/**
 * Fetches the active Flutterwave Public Key configured in Super Admin -> Settings,
 * falling back to build-time Vite environment variables if not yet saved in DB.
 */
export async function getDynamicFlutterwavePublicKey(): Promise<string> {
  try {
    const { data, error } = await (supabase as any).rpc('get_public_payment_config');
    if (!error && data?.flutterwave_public_key) {
      return String(data.flutterwave_public_key).trim();
    }
  } catch (err) {
    console.warn('Falling back to env Flutterwave public key:', err);
  }
  return PUBLIC_KEY;
}
