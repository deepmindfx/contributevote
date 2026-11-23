import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { flutterwaveFetch, getFlutterwaveConfig } from "../_shared/flutterwaveConfig.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TransactionsRequest {
  account_reference: string;
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

    const body: TransactionsRequest = await req.json();
    const reference = typeof body.account_reference === "string" ? body.account_reference.trim() : "";
    if (!reference || reference.length > 180) throw new Error("Invalid account reference");
    const { data: profile, error: profileError } = await supabaseUserClient.from("profiles")
      .select("preferences").eq("id", user.id).maybeSingle();
    const account = profile?.preferences?.virtualAccount;
    const linked = [account, ...(Array.isArray(account?.accounts) ? account.accounts : [])];
    if (profileError || !linked.some((item) =>
      item?.accountReference === reference || item?.account_reference === reference
    )) {
      return new Response(JSON.stringify({ success: false, error: "Account unavailable" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const config = await getFlutterwaveConfig();
    if (!config.secretKey) throw new Error("Flutterwave is unavailable");

    const { response } = await flutterwaveFetch(
      `/virtual-account-numbers/${encodeURIComponent(reference)}/transactions`,
      { method: 'GET', signal: AbortSignal.timeout(9000) },
      config
    );

    if (!response.ok) {
      console.warn("Flutterwave virtual account history request failed", response.status);
      throw new Error("Account history is temporarily unavailable");
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
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
