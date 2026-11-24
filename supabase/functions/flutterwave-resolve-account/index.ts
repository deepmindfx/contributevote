import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { flutterwaveFetch, getFlutterwaveConfig } from "../_shared/flutterwaveConfig.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (payload: unknown, status = 200) => Response.json(payload, { status, headers });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "Sign in to verify an account." }, 401);

  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user?.email_confirmed_at) return json({ error: "Sign in with a confirmed email to continue." }, 401);

    const body = await req.json().catch(() => null);
    const account_number = body?.account_number;
    const account_bank = body?.account_bank || body?.bank_code;
    if (typeof account_number !== "string" || !/^[0-9]{10}$/.test(account_number) ||
      typeof account_bank !== "string" || !/^[a-z0-9]{2,12}$/i.test(account_bank)) {
      return json({ error: "Enter a valid bank and account number." }, 400);
    }

    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: profile, error: profileError } = await db.from("profiles").select("status").eq("id", user.id).maybeSingle();
    if (profileError) return json({ error: "Account verification is unavailable." }, 503);
    if (!profile || (profile.status ?? "active") !== "active") return json({ error: "Your account is restricted." }, 403);

    const { data: allowed, error: quotaError } = await db.rpc("service_claim_bank_lookup_quota", { p_user_id: user.id, p_count: 1 });
    if (quotaError) return json({ error: "Account verification is unavailable." }, 503);
    if (allowed !== true) return json({ error: "Too many account checks. Try again shortly." }, 429);
    const config = await getFlutterwaveConfig({ supabaseAdmin: db });
    if (!config.secretKey) return json({ error: "Account verification is unavailable." }, 503);

    const { response } = await flutterwaveFetch("/accounts/resolve", {
      method: "POST", body: { account_number, account_bank }, signal: AbortSignal.timeout(6000),
    }, config);
    const result = await response.json().catch(() => null);
    const account_name = typeof result?.data?.account_name === "string" ? result.data.account_name.trim().slice(0, 120) : "";
    if (!response.ok || result?.status !== "success" || !account_name ||
      String(result?.data?.account_number) !== account_number) {
      return json({ error: "Couldn’t verify the account number." }, response.status >= 500 ? 503 : 422);
    }
    return json({ success: true, data: { account_name, account_number } });
  } catch {
    return json({ error: "Account verification is unavailable." }, 503);
  }
});
