import { createClient } from 'jsr:@supabase/supabase-js@2';

export const FLUTTERWAVE_BASE_URL = 'https://api.flutterwave.com/v3';

export interface FlutterwaveRuntimeConfig {
  mode: 'live' | 'test';
  publicKey: string;
  secretKey: string;
  encryptionKey: string;
  webhookHash: string;
  webhookUrl: string;
  staticIpProxyUrl: string;
  staticIpProxySecret: string;
  staticIpAddress: string;
  transfersEnabled: boolean;
  source: 'database' | 'env';
}

const CACHE_TTL_MS = 15_000;
let cachedConfig: FlutterwaveRuntimeConfig | null = null;
let cachedAt = 0;

/**
 * Resolves live Flutterwave credentials & Static-IP Relay settings dynamically:
 *   1. Reads `public.platform_payment_settings` (configured in Super Admin -> Settings)
 *   2. Falls back to Supabase Edge Function environment secrets
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
  const envProxyUrl = Deno.env.get('FLW_STATIC_IP_PROXY_URL') || '';
  const envProxySecret = Deno.env.get('FLW_STATIC_IP_PROXY_SECRET') || '';

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
        'flutterwave_mode, flutterwave_public_key, flutterwave_secret_key, flutterwave_encryption_key, flutterwave_webhook_hash, webhook_url, static_ip_proxy_url, static_ip_proxy_secret, static_ip_address, transfers_enabled'
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
  const staticIpProxyUrl = (String(dbRow?.static_ip_proxy_url || '').trim() || envProxyUrl).replace(/\/+$/, '');
  const staticIpProxySecret = String(dbRow?.static_ip_proxy_secret || '').trim() || envProxySecret;
  const staticIpAddress = String(dbRow?.static_ip_address || '').trim() || '2.25.15.1';
  const transfersEnabled = dbRow?.transfers_enabled !== false;
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
    staticIpProxyUrl,
    staticIpProxySecret,
    staticIpAddress,
    transfersEnabled,
    source,
  };
  cachedAt = now;
  return cachedConfig;
}

/**
 * Calls Flutterwave v3 API, routing through the configured Static-IP VPS Relay
 * (with X-Relay-Secret authentication) whenever `staticIpProxyUrl` & `staticIpProxySecret`
 * are active so Flutterwave IP-whitelisted payouts succeed seamlessly.
 *
 * @param v3Path Path starting with `/` relative to `/v3`, e.g. `/transfers`, `/banks/NG`
 */
export async function flutterwaveFetch(
  v3Path: string,
  init: { method?: string; body?: unknown } = {},
  config: FlutterwaveRuntimeConfig
): Promise<{ response: Response; routedViaStaticIp: boolean }> {
  const cleanPath = v3Path.startsWith('/') ? v3Path : `/${v3Path}`;
  const useRelay = Boolean(config.staticIpProxyUrl && config.staticIpProxySecret);
  const url = useRelay
    ? `${config.staticIpProxyUrl}/v3${cleanPath}`
    : `${FLUTTERWAVE_BASE_URL}${cleanPath}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.secretKey}`,
    'Content-Type': 'application/json',
  };
  if (useRelay) {
    headers['X-Relay-Secret'] = config.staticIpProxySecret;
  }

  const response = await fetch(url, {
    method: init.method || 'GET',
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  return { response, routedViaStaticIp: useRelay };
}
