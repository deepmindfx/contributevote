import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
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

    let adminProbe = false;
    if (forceRefresh || checkRelayOnly) {
      const authorization = req.headers.get("Authorization");
      if (authorization) {
        const caller = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          { global: { headers: { Authorization: authorization } } });
        const { data: { user } } = await caller.auth.getUser();
        if (user) {
          const { data } = await caller.rpc("is_admin");
          adminProbe = data === true;
        }
      }
      if (!adminProbe) {
        return Response.json({ error: "Admin access required." }, { status: 403, headers: corsHeaders });
      }
    }
    const config = await getFlutterwaveConfig({ forceRefresh: adminProbe && forceRefresh });

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

      const healthRes = await fetch(`${config.staticIpProxyUrl}/health`, {
        method: "GET", redirect: "error", signal: AbortSignal.timeout(5_000),
      });
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
      throw new Error('The bank directory is unavailable.');
    }

    const data = await response.json();

    return new Response(JSON.stringify({
      success: true,
      data: data.data,
      meta: {
        ...(adminProbe ? {
          mode: config.mode,
          source: config.source,
          routedViaStaticIp,
          staticIpAddress: routedViaStaticIp ? config.staticIpAddress : null,
        } : {}),
        count: Array.isArray(data.data) ? data.data.length : 0,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch {
    return new Response(JSON.stringify({
      success: false,
      error: "The bank directory is unavailable.",
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
