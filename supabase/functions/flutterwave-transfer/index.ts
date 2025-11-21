import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const FLUTTERWAVE_SECRET_KEY = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
const FLUTTERWAVE_BASE_URL = 'https://api.flutterwave.com/v3';

interface TransferRequest {
  account_bank: string;
  account_number: string;
  amount: number;
  narration?: string;
  currency: string;
  beneficiary_name: string;
  user_id: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    if (!FLUTTERWAVE_SECRET_KEY) {
      throw new Error('Flutterwave secret key not configured');
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get user from token
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const body: TransferRequest = await req.json();
    const { account_bank, account_number, amount, narration, currency, beneficiary_name } = body;
    
    if (!account_bank || !account_number || !amount || !currency || !beneficiary_name) {
      throw new Error('Missing required fields');
    }

    // Validate amount
    if (amount < 100) {
      throw new Error('Minimum transfer amount is ₦100');
    }

    if (amount > 500000) {
      throw new Error('Maximum transfer amount is ₦500,000');
    }

    // Check user's wallet balance
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('wallet_balance')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw new Error('Failed to fetch user profile');
    }

    // Calculate fee (Flutterwave charges ₦10.75 for transfers below ₦5,000 and ₦26.5 for above)
    const fee = amount > 5000 ? 26.5 : 10.75;
    const totalAmount = amount + fee;

    if (profile.wallet_balance < totalAmount) {
      throw new Error(`Insufficient balance. You need ₦${totalAmount.toFixed(2)} (₦${amount} + ₦${fee} fee)`);
    }

    // Generate unique reference
    const reference = `TRF_${Date.now()}_${user.id.substring(0, 8)}`;

    // Initiate transfer with Flutterwave
    const transferResponse = await fetch(`${FLUTTERWAVE_BASE_URL}/transfers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_bank,
        account_number,
        amount,
        narration: narration || 'Transfer',
        currency,
        reference,
        callback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/flutterwave-transfer-callback`,
        debit_currency: currency,
        beneficiary_name
      }),
    });

    if (!transferResponse.ok) {
      const errorData = await transferResponse.text();
      console.error('Flutterwave transfer error:', errorData);
      throw new Error('Transfer failed. Please try again.');
    }

    const transferData = await transferResponse.json();
    
    if (transferData.status !== 'success') {
      throw new Error(transferData.message || 'Transfer failed');
    }

    // Deduct from wallet balance
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ 
        wallet_balance: profile.wallet_balance - totalAmount 
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update wallet balance:', updateError);
      throw new Error('Failed to update wallet balance');
    }

    // Create transaction record
    const { error: transactionError } = await supabaseClient
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'transfer',
        amount: amount,
        status: transferData.data.status === 'SUCCESSFUL' ? 'completed' : 'pending',
        description: `Transfer to ${beneficiary_name}`,
        payment_method: 'bank_transfer',
        reference_id: reference,
        meta_data: {
          account_number,
          account_bank,
          beneficiary_name,
          narration,
          fee,
          flutterwave_id: transferData.data.id,
          flutterwave_reference: transferData.data.reference
        }
      });

    if (transactionError) {
      console.error('Failed to create transaction record:', transactionError);
    }

    return new Response(JSON.stringify({
      status: 'success',
      message: 'Transfer initiated successfully',
      data: {
        id: transferData.data.id,
        reference: reference,
        amount: amount,
        fee: fee,
        status: transferData.data.status,
        created_at: new Date().toISOString(),
        full_name: beneficiary_name,
        account_number: account_number,
        bank_name: transferData.data.bank_name || account_bank,
        narration: narration
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Error processing transfer:', error);
    
    return new Response(JSON.stringify({
      status: 'error',
      message: error.message
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
