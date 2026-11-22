import { createClient } from 'jsr:@supabase/supabase-js@2';

export interface FlutterwaveRuntimeConfig {
  mode: 'live' | 'test';
  publicKey: string;
  secretKey: string;
  encryptionKey: string;
  webhookHash: string;
  webhookUrl: string;
  source: 'database' | 'env';
}

const CACHE_TTL_MS = 15_000;
let cachedConfig: FlutterwaveRuntimeConfig | null = null;
let cachedAt = 0;

/**
 * Resolves live Flutterwave credentials dynamically:
 *   1. Reads `public.platform_payment_settings` (configured in Super Admin -> Settings)
 *   2. Falls back to Supabase Edge Function environment secrets (`FLUTTERWAVE_SECRET_KEY`, `FLW_SECRET_HASH`, etc.)
 */
export async function getFlutterwaveConfig(options?: {
  supabaseAdmin?: any;
  forceRefresh?: boolean;
}): Promise<FlutterwaveRuntimeConfig> {
  const now = Date.now();
  if (!options?.forceRefresh && cachedConfig && now - cachedAt < CACHE_TTL_MS) {
    return cachedConfig;
  }

  const envSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY') || '';
  const envPublicKey = Deno.env.get('FLUTTERWAVE_PUBLIC_KEY') || '';
  const envEncryptionKey = Deno.env.get('FLUTTERWAVE_ENCRYPTION_KEY') || '';
  const envWebhookHash =
    Deno.env.get('FLW_SECRET_HASH') ||
    Deno.env.get('FLUTTERWAVE_WEBHOOK_HASH') ||
    '';

  const defaultWebhookUrl = `${Deno.env.get('SUPABASE_URL') || 'https://sivvjwffekhfabgxhbcd.supabase.co'}/functions/v1/webhook-contribution`;

  let dbRow: any = null;
  try {
    const adminClient =
      options?.supabaseAdmin ||
      createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

    const { data, error } = await adminClient
      .from('platform_payment_settings')
      .select(
        'flutterwave_mode, flutterwave_public_key, flutterwave_secret_key, flutterwave_encryption_key, flutterwave_webhook_hash, webhook_url'
      )
      .eq('id', 'default')
      .maybeSingle();

    if (!error && data) {
      dbRow = data;
    }
  } catch (err) {
    console.warn('Could not read platform_payment_settings, falling back to env:', err);
  }

  const secretKey = String(dbRow?.flutterwave_secret_key || '').trim() || envSecretKey;
  const publicKey = String(dbRow?.flutterwave_public_key || '').trim() || envPublicKey;
  const encryptionKey = String(dbRow?.flutterwave_encryption_key || '').trim() || envEncryptionKey;
  const webhookHash = String(dbRow?.flutterwave_webhook_hash || '').trim() || envWebhookHash;
  const webhookUrl = String(dbRow?.webhook_url || '').trim() || defaultWebhookUrl;
  const mode: 'live' | 'test' = dbRow?.flutterwave_mode === 'test' ? 'test' : 'live';
  const source: 'database' | 'env' =
    String(dbRow?.flutterwave_secret_key || '').trim().length > 0 ? 'database' : 'env';

  cachedConfig = {
    mode,
    publicKey,
    secretKey,
    encryptionKey,
    webhookHash,
    webhookUrl,
    source,
  };
  cachedAt = now;
  return cachedConfig;
}
