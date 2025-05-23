const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

// Add a simple localStorage polyfill for Node.js
if (typeof localStorage === 'undefined' || localStorage === null) {
  const LocalStorage = require('node-localstorage').LocalStorage;
  global.localStorage = new LocalStorage('./scratch');
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Flutterwave credentials from .env
const FLW_PUBLIC_KEY = process.env.FLUTTERWAVE_PUBLIC_KEY;
const FLW_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;

app.get('/api/banks', async (req, res) => {
  try {
    const response = await axios.get('https://api.flutterwave.com/v3/banks/NG', {
      headers: {
        Authorization: `Bearer ${FLW_SECRET_KEY}`,
      },
    });
    res.json({ status: 'success', data: response.data.data });
  } catch (error) {
    console.error('Banks fetch error:', error.response?.data || error.message);
    res.status(500).json({ message: error.response?.data?.message || error.message || 'Internal server error' });
  }
});

// Add resolve account endpoint
app.get('/api/resolve-account', async (req, res) => {
  try {
    const { bankCode, accountNumber } = req.query;
    
    if (!bankCode || !accountNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'Bank code and account number are required' 
      });
    }

    // Handle test bank
    if (bankCode === 'TEST001') {
      return res.json({
        success: true,
        data: {
          account_number: accountNumber,
          account_name: "Ali Test Account"
        }
      });
    }

    const response = await axios.post('https://api.flutterwave.com/v3/accounts/resolve', {
      account_number: accountNumber,
      account_bank: bankCode
    }, {
      headers: {
        Authorization: `Bearer ${FLW_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({ 
      success: true, 
      data: response.data.data 
    });
  } catch (error) {
    console.error('Account resolution error:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to resolve account' 
    });
  }
});

// Add transfer endpoint
app.post('/api/transfer', async (req, res) => {
  try {
    const { amount, accountNumber, bankCode, beneficiaryName, currency, narration } = req.body;

    // Validate required fields
    if (!amount || !accountNumber || !bankCode || !beneficiaryName || !currency) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing required fields' 
      });
    }

    // Validate amount
    if (amount < 100) {
      return res.status(400).json({
        success: false,
        message: 'Minimum transfer amount is ₦100'
      });
    }

    if (amount > 500000) {
      return res.status(400).json({
        success: false,
        message: 'Maximum transfer amount is ₦500,000'
      });
    }

    // Handle test bank
    if (bankCode === 'TEST001') {
      return res.json({
        success: true,
        message: 'Transfer initiated successfully',
        data: {
          reference: `TEST-${Date.now()}`,
          status: 'PENDING',
          transferId: `TEST-ID-${Date.now()}`
        }
      });
    }

    // Generate unique reference
    const reference = `TRF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Prepare transfer payload
    const transferPayload = {
      account_bank: bankCode,
      account_number: accountNumber,
      amount: amount,
      narration: narration || 'Transfer from ContributeVote',
      currency: currency,
      reference: reference,
      callback_url: `${process.env.APP_URL || 'http://localhost:8080'}/api/webhook/transfer`,
      debit_currency: currency,
      beneficiary_name: beneficiaryName
    };

    console.log('Initiating transfer with payload:', transferPayload);

    // Initiate transfer with Flutterwave
    const response = await axios.post('https://api.flutterwave.com/v3/transfers', transferPayload, {
      headers: {
        Authorization: `Bearer ${FLW_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Flutterwave transfer response:', response.data);

    if (response.data.status !== 'success') {
      throw new Error(response.data.message || 'Transfer failed');
    }

    // Return success response
    res.json({
      success: true,
      message: 'Transfer initiated successfully',
      data: {
        reference: reference,
        status: 'PENDING',
        transferId: response.data.data.id
      }
    });

  } catch (error) {
    console.error('Transfer error:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to process transfer' 
    });
  }
});

// Add API endpoint for contribution webhooks
app.post('/api/webhook/contribution', (req, res) => {
  try {
    const { type, data } = req.body;
    
    console.log('Received contribution webhook', { type, data });
    
    if (type === 'contribution_received') {
      const { accountNumber, amount, senderName, bankName, paymentReference } = data;
      
      // Store this in localStorage for demo purposes
      // In a real application, this would update a database
      const contributionsString = localStorage.getItem('contributions');
      if (!contributionsString) {
        return res.status(404).json({ success: false, message: 'No contributions found' });
      }
      
      const contributions = JSON.parse(contributionsString);
      const matchingContribution = contributions.find(c => c.accountNumber === accountNumber);
      
      if (!matchingContribution) {
        return res.status(404).json({ 
          success: false, 
          message: 'No contribution found with this account number',
          accountNumber
        });
      }
      
      // Update contribution amount
      matchingContribution.currentAmount += parseFloat(amount);
      
      // Add to contributors
      matchingContribution.contributors.push({
        name: senderName || 'Anonymous',
        amount: parseFloat(amount),
        date: new Date().toISOString(),
        anonymous: !senderName,
      });
      
      // Save back to localStorage
      localStorage.setItem('contributions', JSON.stringify(contributions));
      
      // Create a transaction record
      const transactionsString = localStorage.getItem('transactions');
      const transactions = transactionsString ? JSON.parse(transactionsString) : [];
      
      transactions.push({
        id: paymentReference || `tx_${Date.now()}`,
        contributionId: matchingContribution.id,
        userId: matchingContribution.creatorId,
        type: 'deposit',
        amount: parseFloat(amount),
        description: `Contribution to ${matchingContribution.name} via bank transfer`,
        status: 'completed',
        createdAt: new Date().toISOString(),
        metaData: {
          senderName: senderName || 'Anonymous',
          bankName: bankName || 'Bank Transfer',
          paymentReference: paymentReference || `tx_${Date.now()}`,
        }
      });
      
      localStorage.setItem('transactions', JSON.stringify(transactions));
      
      return res.status(200).json({
        success: true,
        message: 'Contribution processed successfully',
        data: {
          contributionId: matchingContribution.id,
          amount: parseFloat(amount)
        }
      });
    }
    
    return res.status(400).json({ success: false, message: 'Unknown webhook type' });
  } catch (error) {
    console.error('Error processing contribution webhook:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error processing contribution', 
      error: error.message 
    });
  }
});

// Add API endpoint to simulate a bank transfer to a contribution
app.post('/api/simulate-contribution-transfer', (req, res) => {
  try {
    const { accountNumber, amount, senderName, bankName } = req.body;
    
    if (!accountNumber || !amount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Account number and amount are required' 
      });
    }
    
    // Find the contribution
    const contributionsString = localStorage.getItem('contributions');
    if (!contributionsString) {
      return res.status(404).json({ success: false, message: 'No contributions found' });
    }
    
    const contributions = JSON.parse(contributionsString);
    const matchingContribution = contributions.find(c => c.accountNumber === accountNumber);
    
    if (!matchingContribution) {
      return res.status(404).json({ 
        success: false, 
        message: 'No contribution found with this account number',
        accountNumber
      });
    }
    
    // Simulate a webhook call to our own endpoint
    const paymentReference = `sim_tx_${Date.now()}`;
    
    // Call the contribution webhook endpoint
    setTimeout(() => {
      try {
        const webhookData = {
          type: 'contribution_received',
          data: {
            accountNumber,
            amount: parseFloat(amount),
            senderName: senderName || 'Test Sender',
            bankName: bankName || 'Test Bank',
            paymentReference,
            timestamp: new Date().toISOString()
          }
        };
        
        axios.post('http://localhost:' + PORT + '/api/webhook/contribution', webhookData)
          .then(response => {
            console.log('Simulated webhook sent successfully:', response.data);
          })
          .catch(error => {
            console.error('Error sending simulated webhook:', error);
          });
      } catch (error) {
        console.error('Error in simulation timeout:', error);
      }
    }, 2000); // Simulate a 2-second delay
    
    return res.status(200).json({
      success: true,
      message: 'Simulated transfer initiated',
      data: {
        accountNumber,
        amount: parseFloat(amount),
        paymentReference
      }
    });
  } catch (error) {
    console.error('Error simulating transfer:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error simulating transfer', 
      error: error.message 
    });
  }
});

// Add test charge completed endpoint
app.post('/api/test/simulate-charge-completed', async (req, res) => {
  try {
    const { amount = 5000, userId, tx_ref = `TEST_TX_${Date.now()}` } = req.body;
    console.log('Simulating charge.completed webhook with data:', { amount, userId, tx_ref });

    // Create a simulated webhook payload
    const webhookPayload = {
      event: 'charge.completed',
      data: {
        id: Math.floor(Math.random() * 1000000),
        tx_ref: tx_ref,
        flw_ref: `FLW_${Math.floor(Math.random() * 1000000)}`,
        amount,
        currency: 'NGN',
        status: 'successful',
        payment_type: 'card',
        created_at: new Date().toISOString(),
        customer: {
          id: 1,
          name: 'Test Customer',
          email: 'test@example.com',
          phone_number: null,
          created_at: new Date().toISOString()
        },
        card: {
          first_6digits: '123456',
          last_4digits: '7890',
          issuer: 'TEST BANK',
          country: 'NG',
          type: 'VISA',
          expiry: '01/25'
        }
      }
    };

    console.log('Simulating charge.completed webhook:', webhookPayload);

    try {
      // Process the webhook as if it came from Flutterwave
      // Skip signature verification for testing
      const result = await handleWebhook(webhookPayload, process.env.FLUTTERWAVE_SECRET_HASH || 'test_signature');
      
      console.log('Webhook handling result:', result);

      return res.status(200).json({
        status: 'success',
        message: 'Simulated webhook processed',
        result
      });
    } catch (webhookError) {
      console.error('Error handling webhook:', webhookError);
      return res.status(500).json({
        status: 'error',
        message: webhookError instanceof Error ? webhookError.message : 'Error handling webhook',
        error: webhookError
      });
    }
  } catch (error) {
    console.error('Error simulating webhook:', error);
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      error: JSON.stringify(error)
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 
