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

    // Check if this is a deadlines-only run
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const deadlinesOnly = body.deadlines_only === true;

    const now = new Date().toISOString();
    const results = {
      recurring: { processed: 0, failed: 0 },
      scheduled: { processed: 0, failed: 0 },
      refunds: { processed: 0, failed: 0 },
      mode: deadlinesOnly ? 'deadlines-only' : 'full',
    };

    // 1. Process Recurring Contributions (skip if deadlines-only mode)
    if (!deadlinesOnly) {
      const { data: recurringDue } = await supabaseClient
        .from('recurring_contributions')
        .select('*')
        .eq('status', 'active')
        .lte('next_contribution_date', now);

      if (recurringDue) {
      for (const recurring of recurringDue) {
        try {
          // Check if end date passed
          if (recurring.end_date && new Date(recurring.end_date) < new Date()) {
            await supabaseClient
              .from('recurring_contributions')
              .update({ status: 'completed' })
              .eq('id', recurring.id);
            continue;
          }

          // Process contribution from wallet
          const { error: contributeError } = await supabaseClient.rpc(
            'contribute_from_wallet',
            {
              p_user_id: recurring.user_id,
              p_group_id: recurring.group_id,
              p_amount: recurring.amount,
            }
          );

          if (contributeError) throw contributeError;

          // Calculate next contribution date
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

          // Update next contribution date
          await supabaseClient
            .from('recurring_contributions')
            .update({ next_contribution_date: nextDate.toISOString() })
            .eq('id', recurring.id);

          results.recurring.processed++;
        } catch (error) {
          console.error(`Failed to process recurring ${recurring.id}:`, error);
          results.recurring.failed++;
        }
      }
      }
    }

    // 2. Process Scheduled Contributions (skip if deadlines-only mode)
    if (!deadlinesOnly) {
    const { data: scheduledDue } = await supabaseClient
      .from('scheduled_contributions')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_date', now);

    if (scheduledDue) {
      for (const scheduled of scheduledDue) {
        try {
          // Process contribution from wallet
          const { error: contributeError } = await supabaseClient.rpc(
            'contribute_from_wallet',
            {
              p_user_id: scheduled.user_id,
              p_group_id: scheduled.group_id,
              p_amount: scheduled.amount,
            }
          );

          if (contributeError) throw contributeError;

          // Mark as completed
          await supabaseClient
            .from('scheduled_contributions')
            .update({ status: 'completed' })
            .eq('id', scheduled.id);

          results.scheduled.processed++;
        } catch (error) {
          console.error(`Failed to process scheduled ${scheduled.id}:`, error);
          
          // Mark as failed
          await supabaseClient
            .from('scheduled_contributions')
            .update({ status: 'failed' })
            .eq('id', scheduled.id);

          results.scheduled.failed++;
        }
      }
      }
    }

    // 3. Process Refund Voting Deadlines (always run - but most refunds are instant now)
    const { data: refundsDue } = await supabaseClient
      .from('group_refund_requests')
      .select('*')
      .eq('status', 'pending')
      .lte('voting_deadline', now);

    if (refundsDue) {
      for (const refund of refundsDue) {
        try {
          // Count votes
          const votesFor = refund.votes_for?.length || 0;
          const votesAgainst = refund.votes_against?.length || 0;
          const totalVotes = votesFor + votesAgainst;

          // Get total eligible voters (contributors with voting rights)
          const { count: eligibleVoters } = await supabaseClient
            .from('contributors')
            .select('*', { count: 'only', head: true })
            .eq('group_id', refund.group_id)
            .eq('has_voting_rights', true);

          const participationRate = eligibleVoters ? (totalVotes / eligibleVoters) * 100 : 0;
          const approvalRate = totalVotes > 0 ? (votesFor / totalVotes) * 100 : 0;

          // Check governance rules: 60% approval + 70% participation
          const approved = approvalRate >= 60 && participationRate >= 70;

          if (approved) {
            // Process refund
            const { error: refundError } = await supabaseClient.rpc(
              'process_group_refund',
              {
                p_refund_request_id: refund.id,
              }
            );

            if (refundError) throw refundError;

            results.refunds.processed++;
          } else {
            // Mark as rejected
            await supabaseClient
              .from('group_refund_requests')
              .update({ status: 'rejected' })
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
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
