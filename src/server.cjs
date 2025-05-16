// Add a mock transactions endpoint for development
app.get('/api/flutterwave/reserved-accounts/:accountReference/transactions', (req, res) => {
  const { accountReference } = req.params;
  console.log(`[Mock API] GET transactions for reserved account: ${accountReference}`);
  
  // For development, we'll return a real-shaped response with empty content
  // This ensures the frontend can process real data when it arrives
  res.json({
    status: 'success',
    message: 'Transactions retrieved successfully',
    data: {
      status: 'success',
      message: 'Transactions retrieved successfully',
      content: []
    }
  });
});

// In-memory storage for simulated transactions
const simulatedTransactions = [];

// Make sure we're using port 9000 since that's what's working
const PORT = 9000;

// Add middleware to log all incoming requests for debugging
app.use((req, res, next) => {
  console.log(`[Server] ${req.method} ${req.url}`);
  next();
});

// Enhance the webhook endpoint to store incoming transactions
app.post('/api/flutterwave/webhooks/deposit', (req, res) => {
  console.log('[Webhook] Received deposit notification', JSON.stringify(req.body, null, 2));
  
  // Extract the transaction data
  const { event, data, tx_ref, amount, currency, status } = req.body;
  
  // Handle both the simulated format and the real Flutterwave webhook format
  if (event === "successful_transfer" && data) {
    // Store the transaction in our in-memory store (simulated format)
    simulatedTransactions.push({
      ...data,
      receivedAt: new Date().toISOString()
    });
    
    console.log(`[Webhook] Added simulated transaction to store. Total: ${simulatedTransactions.length}`);
  } else if (event === "charge.completed" && status === "successful") {
    // This is the real Flutterwave webhook format
    // Create a transaction record in the expected format
    const transaction = {
      amount: parseFloat(amount),
      paymentReference: tx_ref,
      status: "successful",
      senderName: "Flutterwave Payment",
      bankName: "Online Payment",
      narration: "Payment completed via Flutterwave",
      paymentDescription: "Online payment",
      transactionReference: tx_ref,
      // Extract the user ID from tx_ref format "COLL_USER-ID_TIMESTAMP"
      destinationAccountNumber: tx_ref ? tx_ref.split('_')[1] : "", 
      paidOn: new Date().toISOString()
    };
    
    // Add to our transaction store
    simulatedTransactions.push({
      ...transaction,
      receivedAt: new Date().toISOString()
    });
    
    console.log(`[Webhook] Added real Flutterwave transaction to store: ${JSON.stringify(transaction)}`);
  } else {
    console.log('[Webhook] Unhandled event type or missing data:', event);
  }
  
  // Return success response to acknowledge receipt
  res.status(200).json({
    status: 'success',
    message: 'Webhook received successfully'
  });
});

// Add a special endpoint directly for the group transaction reference pattern
app.get('/api/flutterwave/reserved-accounts/:accountReference/transactions', (req, res) => {
  const { accountReference } = req.params;
  console.log(`[API] GET transactions for reserved account: ${accountReference}`);
  
  // Filter transactions for this account reference
  const accountTransactions = simulatedTransactions.filter(
    t => t.destinationAccountNumber === accountReference
  );
  
  console.log(`[API] Found ${accountTransactions.length} transactions for ${accountReference}`);
  
  // Return the transactions in the expected format
  res.json({
    status: 'success',
    message: 'Transactions retrieved successfully',
    data: {
      status: 'success',
      message: 'Transactions retrieved successfully',
      content: accountTransactions
    }
  });
});

// Add wildcard handler for any other reserved accounts request
app.get('/reserved-accounts/:accountReference/transactions', (req, res) => {
  const { accountReference } = req.params;
  console.log(`[API] GET transactions from short path for account: ${accountReference}`);
  
  // Filter transactions for this account reference
  const accountTransactions = simulatedTransactions.filter(
    t => t.destinationAccountNumber === accountReference
  );
  
  console.log(`[API] Found ${accountTransactions.length} transactions from short path for ${accountReference}`);
  
  // Return the transactions in the expected format
  res.json({
    status: 'success',
    message: 'Transactions retrieved successfully',
    data: {
      status: 'success',
      message: 'Transactions retrieved successfully',
      content: accountTransactions
    }
  });
});

// Catch-all handler for any missing reserved-accounts routes
app.use('/reserved-accounts/:accountReference/*', (req, res) => {
  const { accountReference } = req.params;
  console.log(`[API] Catch-all handler for: ${req.method} ${req.url}`);
  
  res.json({
    status: 'success',
    message: 'No transactions available',
    data: {
      status: 'success',
      message: 'No transactions available',
      content: []
    }
  });
});

// Test endpoint to simulate a bank transfer
app.post('/api/test/simulate-bank-transfer', (req, res) => {
  const { amount, accountNumber, accountReference, senderName, bankName } = req.body;
  
  if (!amount || !accountReference) {
    return res.status(400).json({
      status: 'error',
      message: 'Amount and accountReference are required'
    });
  }
  
  console.log(`[Test] Simulating bank transfer: ${amount} to ${accountReference}`);
  
  // Create a transaction with a unique reference
  const transaction = {
    amount: parseFloat(amount),
    paymentReference: `tx_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    status: "successful",
    senderName: senderName || "Test Sender",
    bankName: bankName || "Test Bank",
    narration: "Test bank transfer",
    paymentDescription: "Bank transfer",
    transactionReference: `ref_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    destinationAccountNumber: accountNumber || accountReference,
    paidOn: new Date().toISOString()
  };
  
  // Add the transaction to our store immediately
  simulatedTransactions.push({
    ...transaction,
    receivedAt: new Date().toISOString()
  });
  
  console.log(`[Test] Added transaction to store. Total: ${simulatedTransactions.length}`);
  
  // Return success with transaction details
  res.status(200).json({
    status: 'success',
    message: 'Transfer simulated successfully',
    data: {
      transaction
    }
  });
  
  // In a real implementation, you would now trigger a webhook to notify the system
  // For simplicity, we'll simulate the webhook directly
  
  // Get all reserved accounts endpoint path
  const webhookData = {
    event: "successful_transfer",
    data: {
      ...transaction
    }
  };
  
  // Make a webhook call
  setTimeout(() => {
    fetch(`http://localhost:${PORT}/api/flutterwave/webhooks/deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookData)
    })
    .then(response => response.json())
    .then(data => console.log('[Webhook Simulation] Response:', data))
    .catch(error => console.error('[Webhook Simulation] Error:', error));
  }, 1000);
});

// Add endpoint to simulate a charge.completed webhook
app.post('/api/test/simulate-charge-completed', (req, res) => {
  const { amount, tx_ref, userId } = req.body;
  
  if (!amount || !userId) {
    return res.status(400).json({
      status: 'error',
      message: 'Amount and userId are required'
    });
  }
  
  // Create webhook data in the format from Flutterwave
  const webhookData = {
    event: "charge.completed",
    tx_ref: tx_ref || `COLL_${userId}_${Date.now()}`,
    amount: parseFloat(amount),
    currency: "NGN",
    status: "successful"
  };
  
  console.log(`[Test] Simulating charge.completed webhook: ${JSON.stringify(webhookData)}`);
  
  // Create the transaction directly and add it to our store
  const transaction = {
    amount: parseFloat(amount),
    paymentReference: webhookData.tx_ref,
    status: "successful",
    senderName: "Direct Charge",
    bankName: "Online Payment",
    narration: "Charge completed",
    paymentDescription: "Online payment",
    transactionReference: webhookData.tx_ref,
    destinationAccountNumber: userId,
    paidOn: new Date().toISOString()
  };
  
  // Add to our transaction store immediately
  simulatedTransactions.push({
    ...transaction,
    receivedAt: new Date().toISOString()
  });
  
  console.log(`[Test] Added charge.completed transaction to store. Total: ${simulatedTransactions.length}`);
  
  // Make a webhook call to our endpoint
  fetch(`http://localhost:${PORT}/api/flutterwave/webhooks/deposit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(webhookData)
  })
  .then(response => response.json())
  .then(data => {
    console.log('[Webhook Simulation] Response:', data);
    res.status(200).json({
      status: 'success',
      message: 'Charge completed webhook simulated successfully',
      data: webhookData
    });
  })
  .catch(error => {
    console.error('[Webhook Simulation] Error:', error);
    // Even if webhook fails, we've already added the transaction to our store
    // so just return success
    res.status(200).json({
      status: 'success',
      message: 'Charge completed transaction added (webhook failed)',
      data: webhookData
    });
  });
});

// Add a catchall route for all Flutterwave API paths
app.use('/api/flutterwave/*', (req, res) => {
  console.log(`[API] Catch-all handler for: ${req.method} ${req.url}`);
  
  // Return empty success response
  res.json({
    status: 'success',
    message: 'No transactions available',
    data: {
      status: 'success',
      message: 'No transactions available',
      content: []
    }
  });
});

// Update the port to 9000 to match what's actually running
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 