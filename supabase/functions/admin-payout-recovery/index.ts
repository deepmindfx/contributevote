import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getFlutterwaveConfig } from "../_shared/flutterwaveConfig.ts";
import { reconcileBankTransfer, transferReconciliationFields } from "../_shared/reconcileBankTransfer.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { headers, status });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers, status: 204 });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "Sign in again." }, 401);

  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user) return json({ error: "Sign in again." }, 401);
    const { data: isAdmin } = await caller.rpc("is_admin");
    if (isAdmin !== true) return json({ error: "Admin access required." }, 403);

    const body = await req.json().catch(() => null);
    if (typeof body?.approve !== "boolean" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body?.review_id ?? "")
      || !/^\d{4}$/.test(body?.pin ?? "")) return json({ error: "Review the decision and enter your PIN." }, 400);

    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: review, error: reviewError } = await db.from("payout_recovery_reviews")
      .select("transaction_id,status,basis,submitted_by").eq("id", body.review_id).maybeSingle();
    if (reviewError || !review) return json({ error: "Payout review is unavailable." }, 404);

    let providerStatus: string | null = null;
    if (body.approve && review.status === "pending") {
      if (review.submitted_by === user.id) return json({ error: "A different administrator must verify this evidence." }, 409);
      const { data: payout, error: payoutError } = await db.from("transactions").select(transferReconciliationFields)
        .eq("id", review.transaction_id).maybeSingle();
      if (payoutError || !payout || payout.status !== "pending") return json({ error: "The payout status changed. Refresh the review." }, 409);
      const config = await getFlutterwaveConfig({ supabaseAdmin: db });
      const status = await reconcileBankTransfer(db, payout, config, { onProviderStatus: value => { providerStatus = value; } });
      if (status === "completed" || providerStatus === "SUCCESSFUL") return json({ error: "Flutterwave reports this payout was paid." }, 409);
      if (!["FAILED", "CANCELLED", "CANCELED", "REVERSED"].includes(providerStatus ?? "")
        && !(providerStatus === "NOT_FOUND" && review.basis === "not_debited")) {
        return json({ error: "Flutterwave has not confirmed a compatible payout status. The wallet remains reserved." }, 409);
      }
    }
    const { data, error } = await db.rpc("service_decide_payout_recovery", {
      p_admin_id: user.id, p_review_id: body.review_id, p_approve: body.approve,
      p_pin: body.pin, p_provider_status: providerStatus,
    });
    if (error) return json({ error: error.message }, 409);
    if (data?.error) return json({ error: data.error }, 422);
    return json(data);
  } catch {
    return json({ error: "The payout review is unavailable. Try again." }, 503);
  }
});
