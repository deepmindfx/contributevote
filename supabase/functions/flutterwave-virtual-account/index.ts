import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getFlutterwaveConfig } from "../_shared/flutterwaveConfig.ts";

const FLUTTERWAVE_BASE_URL = 'https://api.flutterwave.com/v3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VirtualAccountRequest {
  email: string;
  tx_ref: string;
  bvn: string;
  narration: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUserClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('status')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.status && profile.status !== 'active') {
      throw new Error(`Your account is currently ${profile.status} and cannot create a virtual account.`);
    }

    const config = await getFlutterwaveConfig({ supabaseAdmin });
    if (!config.secretKey) {
      throw new Error('Flutterwave secret key not configured');
    }

    const body: VirtualAccountRequest = await req.json();
    const cleanBvn = String(body.bvn || '').replace(/\D/g, '');
    if (!body.email || !body.tx_ref || cleanBvn.length !== 11 || !body.narration) {
      throw new Error('Missing required fields: email, tx_ref, 11-digit bvn, narration');
    }

    const response = await fetch(`${FLUTTERWAVE_BASE_URL}/virtual-account-numbers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: body.email,
        tx_ref: body.tx_ref,
        bvn: cleanBvn,
        narration: body.narration,
        is_permanent: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Flutterwave API error:', errorData);
      throw new Error(`Flutterwave API error: ${response.status}`);
    }

    const data = await response.json();

    return new Response(JSON.stringify({
      success: true,
      data: data.data,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('Error creating virtual account:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
