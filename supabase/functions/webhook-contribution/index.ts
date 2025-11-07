import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      success: false,
      message: 'Method not allowed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const webhookData = await req.json();
    console.log('Received webhook:', webhookData);

    // Handle Flutterwave webhooks
    if (webhookData.event) {
      return await handleFlutterwaveWebhook(supabase, webhookData);
    }

    // Handle custom contribution webhooks (legacy)
    const { type, data } = webhookData;
    if (type === 'contribution_received') {
      return await handleContributionWebhook(supabase, data);
    }

    // Handle virtual account credit
    if (type === 'virtual_account_credit') {
      return await handleVirtualAccountCredit(supabase, data);
    }

    return new Response(JSON.stringify({
      success: false,
      message: 'Unknown webhook type'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Server error processing webhook',
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

// Handle Flutterwave webhook events
async function handleFlutterwaveWebhook(supabase: any, webhookData: any) {
  const { event, data } = webhookData;

  console.log('Processing Flutterwave webhook:', event);

  if (event === 'charge.completed' && data) {
    return await handleSuccessfulPayment(supabase, data);
  }

  if (event === 'transfer.completed' && data) {
    return await handleSuccessfulTransfer(supabase, data);
  }

  // Handle virtual account credit
  if (event === 'transfer.completed' && data.account_number) {
    return await handleVirtualAccountCredit(supabase, data);
  }

  return new Response(JSON.stringify({
    success: true,
    message: 'Webhook received but not processed',
    event
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200
  });
}

// Handle successful payment (card/online payment)
// This grants automatic voting rights if it's a contribution
async function handleSuccessfulPayment(supabase: any, paymentData: any) {
  try {
    const userEmail = paymentData.customer?.email;
    if (!userEmail) {
      return new Response(JSON.stringify({ success: true, message: 'No email found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Find user by email
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', userEmail)
      .single();

    if (userError || !user) {
      return new Response(JSON.stringify({ success: true, message: 'User not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Use flw_ref as primary reference (unique per transaction)
    const referenceId = paymentData.flw_ref || paymentData.tx_ref;
    
    // Check if already processed
    const { data: existingTx, error: checkError } = await supabase
      .from('transactions')
      .select('id, reference_id, amount, created_at, metadata')
      .eq('reference_id', referenceId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing transaction:', checkError);
    }

    if (existingTx) {
      if (Math.abs(existingTx.amount - paymentData.amount) > 0.01) {
        console.warn('⚠️ Same reference but different amounts - Existing:', existingTx.amount, 'New:', paymentData.amount);
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Already processed',
        existingTransaction: existingTx
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if this is a contribution payment (look for group_id in metadata)
    const groupId = paymentData.meta?.group_id || paymentData.metadata?.group_id;
    const isContribution = !!groupId;

    // Create transaction record
    const transactionData = {
      user_id: user.id,
      contribution_id: isContribution ? groupId : null,
      type: isContribution ? 'contribution' : 'deposit',
      amount: paymentData.amount,
      description: isContribution 
        ? `Contribution to group via ${paymentData.payment_type || 'card'}`
        : `Payment received via ${paymentData.payment_type || 'card'}`,
      reference_id: referenceId,
      payment_method: paymentData.payment_type || 'card',
      status: 'completed',
      metadata: {
        flutterwaveRef: paymentData.flw_ref,
        txRef: paymentData.tx_ref,
        paymentType: paymentData.payment_type,
        currency: paymentData.currency,
        customerEmail: paymentData.customer?.email,
        customerName: paymentData.customer?.name,
        originatorName: paymentData.meta_data?.originatorname,
        bankName: paymentData.meta_data?.bankname,
        isContribution,
        groupId,
        votingRightsGranted: isContribution
      }
    };

    const { error: txError } = await supabase
      .from('transactions')
      .insert(transactionData);

    if (txError) {
      console.error('Error creating transaction:', txError);
      throw txError;
    }

    // If this is a contribution, add contributor with voting rights
    if (isContribution) {
      await addContributorWithVotingRights(supabase, groupId, user.id, paymentData.amount);
    }

    // Update user wallet balance (for non-contribution payments)
    if (!isContribution) {
      const currentBalance = user.wallet_balance || 0;
      const newBalance = currentBalance + paymentData.amount;
      
      const { error: balanceError } = await supabase
        .from('profiles')
        .update({ wallet_balance: newBalance })
        .eq('id', user.id);

      if (balanceError) {
        console.error('Error updating wallet balance:', balanceError);
        throw balanceError;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: isContribution ? 'Contribution processed with voting rights' : 'Payment processed successfully',
      data: { userId: user.id, amount: paymentData.amount, isContribution, votingRights: isContribution }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error handling successful payment:', error);
    throw error;
  }
}

// Helper function to add contributor with voting rights
async function addContributorWithVotingRights(supabase: any, groupId: string, userId: string, amount: number) {
  try {
    // Check if contributor already exists
    const { data: existing } = await supabase
      .from('contributors')
      .select('*')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      // Update existing contributor
      await supabase
        .from('contributors')
        .update({
          total_contributed: existing.total_contributed + amount,
          contribution_count: existing.contribution_count + 1,
          last_contribution_at: new Date().toISOString(),
          has_voting_rights: true
        })
        .eq('id', existing.id);
    } else {
      // Create new contributor with voting rights
      await supabase
        .from('contributors')
        .insert({
          group_id: groupId,
          user_id: userId,
          total_contributed: amount,
          contribution_count: 1,
          has_voting_rights: true,
          join_method: 'card_payment',
          joined_at: new Date().toISOString(),
          last_contribution_at: new Date().toISOString()
        });
    }

    // Update group current amount
    const { data: group } = await supabase
      .from('contribution_groups')
      .select('current_amount')
      .eq('id', groupId)
      .single();

    if (group) {
      await supabase
        .from('contribution_groups')
        .update({
          current_amount: (group.current_amount || 0) + amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', groupId);
    }

    console.log('✅ Contributor added with voting rights:', { groupId, userId, amount });
  } catch (error) {
    console.error('Error adding contributor:', error);
  }
}

// Helper function to record bank transfer without voting rights
async function recordBankTransferContribution(supabase: any, groupId: string, amount: number, senderInfo: any) {
  try {
    // Create anonymous contributor without voting rights
    await supabase
      .from('contributors')
      .insert({
        group_id: groupId,
        user_id: null,
        total_contributed: amount,
        contribution_count: 1,
        has_voting_rights: false,
        join_method: 'bank_transfer',
        anonymous: true,
        joined_at: new Date().toISOString(),
        last_contribution_at: new Date().toISOString(),
        metadata: {
          senderName: senderInfo.senderName,
          senderBank: senderInfo.senderBank,
          accountNumber: senderInfo.accountNumber,
          note: 'Bank transfer - requires manual verification for voting rights'
        }
      });

    // Update group current amount
    const { data: group } = await supabase
      .from('contribution_groups')
      .select('current_amount')
      .eq('id', groupId)
      .single();

    if (group) {
      await supabase
        .from('contribution_groups')
        .update({
          current_amount: (group.current_amount || 0) + amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', groupId);
    }

    console.log('✅ Bank transfer recorded (no voting rights):', { groupId, amount, senderInfo });
  } catch (error) {
    console.error('Error recording bank transfer:', error);
  }
}

// Handle virtual account credit (bank transfer)
// This does NOT grant automatic voting rights
async function handleVirtualAccountCredit(supabase: any, creditData: any) {
  try {
    const accountNumber = creditData.account_number || creditData.accountNumber;
    if (!accountNumber) {
      return new Response(JSON.stringify({ success: true, message: 'No account number' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Find user with this virtual account
    const { data: users } = await supabase
      .from('profiles')
      .select('*');

    const user = users?.find((u: any) => {
      const preferences = u.preferences;
      return preferences?.virtualAccount?.accountNumber === accountNumber;
    });

    if (!user) {
      return new Response(JSON.stringify({ success: true, message: 'User not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if transaction already exists
    const referenceId = creditData.payment_reference || creditData.transaction_reference || creditData.reference || `BANK_${creditData.amount}_${Date.now()}`;
    
    const { data: existingTx, error: checkError } = await supabase
      .from('transactions')
      .select('id, reference_id, amount, created_at')
      .eq('reference_id', referenceId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing virtual account transaction:', checkError);
    }

    if (existingTx) {
      // If amounts differ, log warning
      if (Math.abs(existingTx.amount - creditData.amount) > 0.01) {
        console.warn('⚠️ Same reference but different amounts - Existing:', existingTx.amount, 'New:', creditData.amount);
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Already processed',
        existingTransaction: existingTx
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if this is for a contribution group
    const groupId = creditData.meta?.group_id || creditData.metadata?.group_id;
    const isContribution = !!groupId;

    // Create transaction record
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        contribution_id: isContribution ? groupId : null,
        type: isContribution ? 'contribution' : 'deposit',
        amount: creditData.amount,
        description: isContribution
          ? `Bank transfer contribution from ${creditData.sender_name || creditData.senderName || 'Bank'}`
          : `Bank transfer from ${creditData.sender_name || creditData.senderName || 'Bank'}`,
        reference_id: referenceId || `BANK_${Date.now()}`,
        payment_method: 'bank_transfer',
        status: 'completed',
        metadata: {
          senderName: creditData.sender_name || creditData.senderName,
          senderBank: creditData.sender_bank || creditData.bankName,
          narration: creditData.narration,
          paymentReference: creditData.payment_reference,
          transactionReference: creditData.transaction_reference,
          accountNumber: accountNumber,
          isContribution,
          groupId,
          votingRightsGranted: false, // Bank transfers don't get automatic voting rights
          requiresVerification: isContribution
        }
      });

    if (txError) throw txError;

    // If this is a contribution, record it without voting rights
    if (isContribution) {
      await recordBankTransferContribution(supabase, groupId, creditData.amount, {
        senderName: creditData.sender_name || creditData.senderName,
        senderBank: creditData.sender_bank || creditData.bankName,
        accountNumber: accountNumber
      });
    } else {
      // Update user wallet balance (for non-contribution transfers)
      const currentBalance = user.wallet_balance || 0;
      const newBalance = currentBalance + creditData.amount;
      
      const { error: balanceError } = await supabase
        .from('profiles')
        .update({ wallet_balance: newBalance })
        .eq('id', user.id);

      if (balanceError) {
        console.error('Error updating virtual account balance:', balanceError);
        throw balanceError;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: isContribution 
        ? 'Bank transfer contribution recorded (requires admin verification for voting rights)'
        : 'Virtual account credit processed successfully',
      data: { 
        userId: user.id, 
        amount: creditData.amount, 
        isContribution,
        votingRights: false,
        requiresVerification: isContribution
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error handling virtual account credit:', error);
    throw error;
  }
}

// Handle successful transfer (legacy)
async function handleSuccessfulTransfer(supabase: any, transferData: any) {
  console.log('Transfer completed:', transferData);
  return new Response(JSON.stringify({ success: true, message: 'Transfer noted' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Handle contribution webhook (legacy)
async function handleContributionWebhook(supabase: any, data: any) {
  const { accountNumber, amount, senderName, bankName, paymentReference } = data;

  // Find the contribution group by account number
  const { data: contributionGroup, error: findError } = await supabase
    .from('contribution_groups')
    .select('*')
    .eq('account_number', accountNumber)
    .single();

  if (findError || !contributionGroup) {
    return new Response(JSON.stringify({
      success: false,
      message: 'No contribution found with this account number',
      accountNumber
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 404
    });
  }

  // Update contribution amount
  const { error: updateError } = await supabase
    .from('contribution_groups')
    .update({
      current_amount: (contributionGroup.current_amount || 0) + parseFloat(amount)
    })
    .eq('id', contributionGroup.id);

  if (updateError) throw updateError;

  // Add contributor record
  const { error: contributorError } = await supabase
    .from('contributors')
    .insert({
      group_id: contributionGroup.id,
      user_id: null,
      amount: parseFloat(amount),
      anonymous: !senderName
    });

  if (contributorError) throw contributorError;

  // Create a transaction record
  const { error: transactionError } = await supabase
    .from('transactions')
    .insert({
      user_id: contributionGroup.creator_id,
      contribution_id: contributionGroup.id,
      type: 'deposit',
      amount: parseFloat(amount),
      description: `Contribution to ${contributionGroup.name} via bank transfer`,
      status: 'completed',
      reference_id: paymentReference || `tx_${Date.now()}`,
      metadata: {
        senderName: senderName || 'Anonymous',
        bankName: bankName || 'Bank Transfer',
        paymentReference: paymentReference || `tx_${Date.now()}`
      }
    });

  if (transactionError) throw transactionError;

  return new Response(JSON.stringify({
    success: true,
    message: 'Contribution processed successfully',
    data: {
      contributionId: contributionGroup.id,
      amount: parseFloat(amount)
    }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}