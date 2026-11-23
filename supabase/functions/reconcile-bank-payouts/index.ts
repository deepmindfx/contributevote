import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { runPayoutReconciliation } from "../_shared/runPayoutReconciliation.ts";

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey || request.headers.get("Authorization") !== "Bearer " + serviceKey) {
    return new Response(null, { status: 401 });
  }
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);
    return Response.json(await runPayoutReconciliation(db));
  } catch {
    console.error("Payout reconciliation worker could not finish");
    return Response.json({ error: "Payout reconciliation unavailable" }, { status: 503 });
  }
});
