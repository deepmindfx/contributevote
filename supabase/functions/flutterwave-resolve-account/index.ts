import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { flutterwaveFetch, getFlutterwaveConfig } from "../_shared/flutterwaveConfig.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    const config = await getFlutterwaveConfig();
    if (!config.secretKey) {
      throw new Error('Flutterwave secret key not configured');
    }

    const body = await req.json();
    const account_number = body.account_number;
    const account_bank = body.account_bank || body.bank_code;

    if (!account_number || !account_bank) {
      throw new Error('Missing required fields: account_number, account_bank');
    }

    const { response } = await flutterwaveFetch(
      '/accounts/resolve',
      { method: 'POST', body: { account_number, account_bank } },
      config
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Flutterwave API error:', errorData);
      throw new Error(`Failed to resolve account: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error(data.message || 'Failed to resolve account');
    }

    return new Response(JSON.stringify({
      success: true,
      data: data.data,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('Error resolving account:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
