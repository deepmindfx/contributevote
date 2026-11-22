import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { getFlutterwaveConfig } from "../_shared/flutterwaveConfig.ts";
import { reconcileBankTransfer, transferReconciliationFields } from "../_shared/reconcileBankTransfer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (req.method !== "POST") return new Response(null, { status: 405 });
    if (!serviceKey || req.headers.get("Authorization") !== "Bearer " + serviceKey) {
      return new Response(null, { status: 401 });
    }
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceKey
    );

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const deadlinesOnly = body.deadlines_only === true;

    const now = new Date().toISOString();
    const results = {
      recurring: { processed: 0, failed: 0 },
      scheduled: { processed: 0, failed: 0 },
      refunds: { processed: 0, failed: 0 },
      withdrawals: { processed: 0, failed: 0 },
      bankTransfers: { resolved: 0, pending: 0, failed: 0 },
      mode: deadlinesOnly ? 'deadlines-only' : 'full',
    };

    // 1. Process Active Recurring Contributions
    if (!deadlinesOnly) {
      const { data: recurringDue, error: recurringErr } = await supabaseClient
        .from('recurring_contributions')
        .select('*')
        .eq('is_active', true)
        .lte('next_contribution_date', now);

      if (recurringErr) {
        console.error('Error querying recurring_contributions:', recurringErr);
      }

      if (recurringDue) {
        for (const recurring of recurringDue) {
          try {
            if (recurring.end_date && new Date(recurring.end_date) < new Date()) {
              await supabaseClient
                .from('recurring_contributions')
                .update({ is_active: false, updated_at: now })
                .eq('id', recurring.id);
              continue;
            }

            const { data: contributeResult, error: contributeError } = await supabaseClient.rpc(
              'contribute_from_wallet',
              {
                p_user_id: recurring.user_id,
                p_group_id: recurring.group_id,
                p_amount: recurring.amount,
              }
            );

            if (contributeError) throw contributeError;
            if (!contributeResult?.success) {
              throw new Error(contributeResult?.error || 'Wallet contribution failed');
            }

            const nextDate = new Date(recurring.next_contribution_date);
            switch (recurring.frequency) {
              case 'daily':
                nextDate.setDate(nextDate.getDate() + 1);
                break;
              case 'weekly':
                nextDate.setDate(nextDate.getDate() + 7);
                break;
              case 'monthly':
                nextDate.setMonth(nextDate.getMonth() + 1);
                break;
            }

            await supabaseClient
              .from('recurring_contributions')
              .update({
                next_contribution_date: nextDate.toISOString(),
                total_contributions: Number(recurring.total_contributions || 0) + 1,
                total_amount: Number(recurring.total_amount || 0) + Number(recurring.amount || 0),
                last_contribution_at: now,
                updated_at: now,
              })
              .eq('id', recurring.id);

            results.recurring.processed++;
          } catch (error) {
            console.error(`Failed to process recurring ${recurring.id}:`, error);
            results.recurring.failed++;
          }
        }
      }
    }

    // 2. Process One-Time Scheduled Contributions
    if (!deadlinesOnly) {
      const { data: scheduledDue, error: scheduledErr } = await supabaseClient
        .from('scheduled_contributions')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_date', now);

      if (scheduledErr) {
        console.error('Error querying scheduled_contributions:', scheduledErr);
      }

      if (scheduledDue) {
        for (const scheduled of scheduledDue) {
          try {
            const { data: contributeResult, error: contributeError } = await supabaseClient.rpc(
              'contribute_from_wallet',
              {
                p_user_id: scheduled.user_id,
                p_group_id: scheduled.group_id,
                p_amount: scheduled.amount,
              }
            );

            if (contributeError) throw contributeError;
            if (!contributeResult?.success) {
              throw new Error(contributeResult?.error || 'Wallet contribution failed');
            }

            await supabaseClient
              .from('scheduled_contributions')
              .update({
                status: 'completed',
                executed_at: now,
                updated_at: now,
              })
              .eq('id', scheduled.id);

            results.scheduled.processed++;
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            console.error(`Failed to process scheduled ${scheduled.id}:`, reason);

            await supabaseClient
              .from('scheduled_contributions')
              .update({
                status: 'failed',
                failure_reason: reason,
                updated_at: now,
              })
              .eq('id', scheduled.id);

            results.scheduled.failed++;
          }
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

    const { data: pendingTransfers, error: transferError } = await supabaseClient.from('transactions')
      .select(transferReconciliationFields).eq('type','transfer').eq('status','pending')
      .filter('metadata->>pricing_reserved','eq','true')
      .lt('updated_at', new Date(Date.now() - 120_000).toISOString()).order('updated_at').limit(40);
    if (transferError) results.bankTransfers.failed++;
    else if (pendingTransfers?.length) {
      const config = await getFlutterwaveConfig({ supabaseAdmin: supabaseClient });
      for (let offset = 0; offset < pendingTransfers.length; offset += 8) {
        await Promise.all(pendingTransfers.slice(offset, offset + 8).map(async (row) => {
          try {
            const status = await reconcileBankTransfer(supabaseClient, row, config);
            if (status === "pending") results.bankTransfers.pending++;
            else results.bankTransfers.resolved++;
          } catch {
            results.bankTransfers.failed++;
          }
        }));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: now,
        results,
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
