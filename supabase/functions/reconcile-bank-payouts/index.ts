import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { runPayoutReconciliation } from "../_shared/runPayoutReconciliation.ts";
import { getSchedulerClient } from "../_shared/schedulerClient.ts";

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  try {
    const db = await getSchedulerClient(request);
    if (!db) return new Response(null, { status: 401 });
    return Response.json(await runPayoutReconciliation(db));
  } catch {
    console.error("Payout reconciliation worker could not finish");
    return Response.json({ error: "Payout reconciliation unavailable" }, { status: 503 });
  }
});
