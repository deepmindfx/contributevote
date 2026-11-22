import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { flutterwaveFetch, getFlutterwaveConfig } from "../_shared/flutterwaveConfig.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    const url = new URL(req.url);
    let forceRefresh = url.searchParams.get('fresh') === '1';
    let checkRelayOnly = url.searchParams.get('check_relay') === '1';

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      if (body?.fresh === true) forceRefresh = true;
      if (body?.checkRelayOnly === true) checkRelayOnly = true;
    }

    const config = await getFlutterwaveConfig({ forceRefresh });

    // Dedicated health probe for the Static-IP VPS Relay
    if (checkRelayOnly) {
      if (!config.staticIpProxyUrl) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Static-IP Relay URL is not configured yet.',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const healthRes = await fetch(`${config.staticIpProxyUrl}/health`, { method: 'GET' });
      const healthData = await healthRes.json().catch(() => ({}));
      return new Response(JSON.stringify({
        success: healthRes.ok && healthData?.ok === true,
        relay: {
          url: config.staticIpProxyUrl,
          staticIp: healthData?.staticIp || config.staticIpAddress,
          uptimeSec: healthData?.uptimeSec ?? null,
          hasSecret: Boolean(config.staticIpProxySecret),
        },
        error: healthRes.ok ? undefined : `Relay healthcheck returned HTTP ${healthRes.status}`,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!config.secretKey) {
      throw new Error('Flutterwave secret key is not configured. Add it in Super Admin -> Settings.');
    }

    const { response, routedViaStaticIp } = await flutterwaveFetch('/banks/NG', { method: 'GET' }, config);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Flutterwave API error:', errorData);
      throw new Error(`Flutterwave API error (${response.status}): verify your secret key in Gateway Settings`);
    }

    const data = await response.json();

    return new Response(JSON.stringify({
      success: true,
      data: data.data,
      meta: {
        mode: config.mode,
        source: config.source,
        routedViaStaticIp,
        staticIpAddress: routedViaStaticIp ? config.staticIpAddress : null,
        count: Array.isArray(data.data) ? data.data.length : 0,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('Error fetching banks:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
