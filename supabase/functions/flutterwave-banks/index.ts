import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getFlutterwaveConfig } from "../_shared/flutterwaveConfig.ts";

const FLUTTERWAVE_BASE_URL = 'https://api.flutterwave.com/v3';

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

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      if (body?.fresh === true) {
        forceRefresh = true;
      }
    }

    const config = await getFlutterwaveConfig({ forceRefresh });
    if (!config.secretKey) {
      throw new Error('Flutterwave secret key is not configured. Add it in Super Admin -> Gateway Settings.');
    }

    const response = await fetch(`${FLUTTERWAVE_BASE_URL}/banks/NG`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.secretKey}`,
        'Content-Type': 'application/json',
      },
    });

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
