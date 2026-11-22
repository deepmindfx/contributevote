import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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

    // 4. Process Refund Voting Deadlines
    const { data: refundsDue } = await supabaseClient
      .from('group_refund_requests')
      .select('*')
      .eq('status', 'pending')
      .lte('voting_deadline', now);

    if (refundsDue) {
      for (const refund of refundsDue) {
        try {
          const votesArray = Array.isArray(refund.votes) ? refund.votes : [];
          const votesFor =
            typeof refund.total_votes_for === 'number'
              ? refund.total_votes_for
              : votesArray.filter((v: any) => v.vote === 'for').length;
          const votesAgainst =
            typeof refund.total_votes_against === 'number'
              ? refund.total_votes_against
              : votesArray.filter((v: any) => v.vote === 'against').length;
          const totalVotes = votesFor + votesAgainst;

          const { count: eligibleVoters } = await supabaseClient
            .from('contributors')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', refund.group_id)
            .eq('has_voting_rights', true);

          const { data: groupMeta } = await supabaseClient
            .from('contribution_groups')
            .select('voting_threshold, status')
            .eq('id', refund.group_id)
            .maybeSingle();

          // Skip frozen groups until compliance unfreezes them
          if (groupMeta?.status === 'frozen') {
            continue;
          }

          const groupThreshold =
            typeof groupMeta?.voting_threshold === 'number' &&
            groupMeta.voting_threshold >= 50 &&
            groupMeta.voting_threshold <= 100
              ? groupMeta.voting_threshold
              : 60;

          const voterPool = eligibleVoters || refund.total_eligible_voters || 0;
          const participationRate = voterPool > 0 ? (totalVotes / voterPool) * 100 : 0;
          const approvalRate = totalVotes > 0 ? (votesFor / totalVotes) * 100 : 0;

          const approved = approvalRate >= groupThreshold && participationRate >= 70;

          if (approved) {
            // Set status to approved BEFORE calling process_group_refund
            await supabaseClient
              .from('group_refund_requests')
              .update({ status: 'approved', updated_at: now })
              .eq('id', refund.id);

            const { data: refundRes, error: refundError } = await supabaseClient.rpc(
              'process_group_refund',
              { p_refund_request_id: refund.id }
            );

            if (refundError) throw refundError;
            if (!refundRes?.success) {
              throw new Error(refundRes?.error || 'Failed to execute approved refund');
            }

            results.refunds.processed++;
          } else {
            await supabaseClient
              .from('group_refund_requests')
              .update({ status: 'rejected', updated_at: now })
              .eq('id', refund.id);

            results.refunds.processed++;
          }
        } catch (error) {
          console.error(`Failed to process refund ${refund.id}:`, error);
          results.refunds.failed++;
        }
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
