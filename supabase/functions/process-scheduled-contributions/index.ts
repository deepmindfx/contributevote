import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { runPayoutReconciliation } from "../_shared/runPayoutReconciliation.ts";
import { getSchedulerClient } from "../_shared/schedulerClient.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") return new Response(null, { status: 405 });
    const supabaseClient = await getSchedulerClient(req);
    if (!supabaseClient) return new Response(null, { status: 401 });

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const deadlinesOnly = body.deadlines_only === true;

    const now = new Date().toISOString();
    const results = {
      recurring: { processed: 0, failed: 0 },
      scheduled: { processed: 0, failed: 0 },
      refunds: { processed: 0, failed: 0 },
      withdrawals: { processed: 0, failed: 0 },
      mode: deadlinesOnly ? 'deadlines-only' : 'full',
    };

    if (!deadlinesOnly) {
      for (const spec of [
        { table: "recurring_contributions", kind: "recurring", due: "next_contribution_date", counter: results.recurring },
        { table: "scheduled_contributions", kind: "scheduled", due: "scheduled_date", counter: results.scheduled },
      ] as const) {
        const dueQuery = supabaseClient.from(spec.table).select("id," + spec.due).lte(spec.due, now);
        const { data: due, error } = await (spec.kind === "recurring" ? dueQuery.eq("is_active", true) : dueQuery.eq("status", "pending"))
          .order(spec.due).order("id");
        if (error) {
          spec.counter.failed++;
          console.warn("Couldn’t list due contributions", { kind: spec.kind, code: error.code });
          continue;
        }
        for (const item of (due ?? []) as unknown as Array<{ id: string } & Record<string, string>>) {
          const { data, error: chargeError } = await supabaseClient.rpc("service_run_due_contribution", {
            p_kind: spec.kind, p_id: item.id, p_expected_at: item[spec.due],
          });
          if (chargeError || data === "failed") spec.counter.failed++;
          else if (data === "completed") spec.counter.processed++;
        }
      }
    }

    // 3. Process Pending Withdrawal Requests (thresholds & deadlines)
    const { data: withdrawalsPending } = await supabaseClient
      .from('withdrawal_requests')
      .select('id')
      .eq('status', 'pending');

    if (withdrawalsPending) {
      for (const withdrawal of withdrawalsPending) {
        try {
          const { data: votingResult, error: votingError } = await supabaseClient.rpc(
            'check_withdrawal_voting',
            { p_withdrawal_id: withdrawal.id }
          );

          if (votingError) throw votingError;
          if (votingResult?.success) {
            results.withdrawals.processed++;
          }
        } catch (error) {
          console.error(`Failed to check withdrawal ${withdrawal.id}:`, error);
          results.withdrawals.failed++;
        }
      }
    }

    const { data: expiredRefunds, error: refundError } = await supabaseClient.rpc('service_close_expired_refund_votes');
    if (refundError) results.refunds.failed++;
    else results.refunds.processed = Number(expiredRefunds) || 0;

    // Approval and payout can be separated by a temporary group hold.
    const retryBefore = new Date(Date.now() - 60_000).toISOString();
    for (const spec of [
      { table: "withdrawal_requests", kind: "withdrawal", counter: results.withdrawals },
      { table: "group_refund_requests", kind: "refund", counter: results.refunds },
    ] as const) {
      let approved = supabaseClient.from(spec.table).select("id").eq("status", "approved").lt("updated_at", retryBefore);
      if (spec.kind === "refund") approved = approved.eq("verified_request", true);
      const { data: due, error } = await approved.order("updated_at").order("id").limit(10);
      if (error) { spec.counter.failed++; continue; }
      for (const item of due ?? []) {
        const { data, error: retryError } = await supabaseClient.rpc("service_retry_approved_group_settlement", { p_kind: spec.kind, p_id: item.id });
        if (retryError) spec.counter.failed++;
        else if (data) spec.counter.processed++;
      }
    }

    let payoutBackup: Awaited<ReturnType<typeof runPayoutReconciliation>> | null = null;
    if (!deadlinesOnly) {
      try {
        payoutBackup = await runPayoutReconciliation(supabaseClient, true);
      } catch {
        console.warn("Scheduled payout backup could not finish");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: now,
        results,
        payoutBackup,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Cron job error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
