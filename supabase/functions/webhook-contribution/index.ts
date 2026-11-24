import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getFlutterwaveConfig } from "../_shared/flutterwaveConfig.ts";
import { findMatchingProviderIds, reconcileBankTransfer, transferReconciliationFields } from "../_shared/reconcileBankTransfer.ts";
import { applyVerifiedInbound, fetchVerifiedInbound } from "../_shared/verifiedInbound.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, verif-hash",
  "Content-Type": "application/json",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { headers, status });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers, status: 204 });
  if (req.method === "GET") return json({ success: true, message: "Webhook endpoint is active" });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const config = await getFlutterwaveConfig({ supabaseAdmin: db });
    if (!config.webhookHash) return json({ error: "Webhook verification unavailable" }, 503);
    const signature = req.headers.get("verif-hash");
    if (!signature || signature !== config.webhookHash) return json({ error: "Invalid signature" }, 401);

    const body = await req.json().catch(() => null);
    const event = body?.event || body?.type;
    const data = body?.data;
    if (!event || !data) return json({ error: "Invalid webhook" }, 400);

    if (event === "transfer.completed") {
      const reference = data.reference;
      if (typeof reference === "string" && reference.startsWith("TRF_")) {
        const { data: row, error } = await db.from("transactions").select(transferReconciliationFields)
          .eq("type", "transfer").eq("reference_id", reference).maybeSingle();
        if (error) throw error;
        if (row?.metadata?.dispatched_at) {
          const [recordId] = findMatchingProviderIds(row, [data]);
          let conflictingSuccess = false;
          await reconcileBankTransfer(db, row, config, {
            recordId,
            auditRecovered: true,
            onProviderStatus: status => { conflictingSuccess = status === "SUCCESSFUL" && row.status === "failed"; },
          });
          if (conflictingSuccess) {
            const { error: auditError } = await db.rpc("service_flag_payout_recovery_conflict", { p_reference: reference });
            if (auditError) throw auditError;
          }
        }
      }
      return json({ received: true });
    }

    if (["charge.completed", "virtual_account_credit", "contribution_received"].includes(event)) {
      if (event === "charge.completed" && typeof data.status === "string" && data.status.toLowerCase() !== "successful") {
        return json({ received: true });
      }
      const charge = await fetchVerifiedInbound(config, data.id ?? data.transaction_id, data.tx_ref);
      if (!charge) return json({ error: "Payment verification pending" }, 503);
      const result = await applyVerifiedInbound(db, charge);
      return json({ success: true, ...result });
    }
    return json({ received: true });
  } catch {
    console.warn("Flutterwave webhook settlement will be retried");
    return json({ error: "Settlement unavailable" }, 503);
  }
});
