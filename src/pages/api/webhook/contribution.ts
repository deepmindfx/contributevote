import type { NextApiRequest, NextApiResponse } from 'next';
import { getContributions, saveContributions, createTransaction } from '@/services/localStorage';
import { v4 as uuidv4 } from 'uuid';

type ResponseData = {
  success: boolean;
  message: string;
  data?: any;
};

// This is a server-side only API endpoint that receives webhooks from Flutterwave
// When real bank transfers are made to contribution accounts
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.authorization;
    const clientSecret = process.env.CLIENT_SECRET;
    
    if (!authHeader || !clientSecret || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== clientSecret) {
      console.error('Unauthorized webhook attempt');
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Get the webhook data
    const { type, data } = req.body;
    
    if (type !== 'contribution_received' || !data) {
      return res.status(400).json({ success: false, message: 'Invalid webhook payload' });
    }
    
    const { accountNumber, amount, senderName, bankName, paymentReference, paymentDescription, timestamp } = data;
    
    if (!accountNumber || !amount) {
      return res.status(400).json({ success: false, message: 'Missing required webhook data' });
    }

    // Process the webhook
    // 1. Find the contribution by account number
    const contributions = getContributions();
    const matchingContribution = contributions.find(c => c.accountNumber === accountNumber);
    
    if (!matchingContribution) {
      return res.status(404).json({ 
        success: false, 
        message: 'No contribution found with this account number',
        data: { accountNumber }
      });
    }
    
    // 2. Update contribution amount
    matchingContribution.currentAmount += parseFloat(amount);
    
    // 3. Add to contributors
    matchingContribution.contributors = matchingContribution.contributors || [];
    matchingContribution.contributors.push({
      id: uuidv4(),
      name: senderName || 'Anonymous',
      amount: parseFloat(amount),
      date: timestamp || new Date().toISOString(),
      anonymous: !senderName,
    });
    
    // 4. Save updated contributions
    saveContributions(contributions);
    
    // 5. Create a transaction record
    try {
      createTransaction({
        contributionId: matchingContribution.id,
        userId: matchingContribution.creatorId,
        type: 'deposit',
        amount: parseFloat(amount),
        description: paymentDescription || `Bank transfer to ${matchingContribution.name}`,
        status: 'completed',
        reference: paymentReference,
        metaData: {
          senderName: senderName || 'Anonymous',
          bankName: bankName || 'Bank Transfer',
          paymentReference,
          paymentDescription,
        }
      });
    } catch (error) {
      console.error('Failed to create transaction record:', error);
      // Continue anyway since the contribution was updated
    }
    
    return res.status(200).json({
      success: true,
      message: 'Contribution payment processed',
      data: {
        contributionId: matchingContribution.id,
        amount: parseFloat(amount)
      }
    });
  } catch (error: any) {
    console.error('Error processing contribution webhook:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'Internal server error', 
    });
  }
} 