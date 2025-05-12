const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 