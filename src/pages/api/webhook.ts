import { NextApiRequest, NextApiResponse } from 'next';
import { getBaseContributions, getBaseCurrentUser } from '@/services/localStorage/storageUtils';
import { updateUserBalance } from '@/services/localStorage/utilityOperations';
import { createTransaction } from '@/services/localStorage/transactionOperations';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // Verify the request is authorized
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    if (token !== process.env.CLIENT_SECRET) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    const { type, data } = req.body;

    if (type === 'payment_success') {
      const { tx_ref, amount, contributionId, timestamp } = data;

      // Get the contribution
      const contribution = getBaseContributions().find(c => c.id === contributionId);
      if (!contribution) {
        return res.status(404).json({ success: false, message: 'Contribution not found' });
      }

      // Update contribution amount
      contribution.currentAmount += amount;
      const contributions = getBaseContributions();
      const contributionIndex = contributions.findIndex(c => c.id === contributionId);
      if (contributionIndex >= 0) {
        contributions[contributionIndex] = contribution;
        localStorage.setItem('contributions', JSON.stringify(contributions));
      }

      // Create transaction record
      createTransaction({
        id: crypto.randomUUID(),
        createdAt: timestamp,
        userId: contribution.creatorId,
        type: 'deposit',
        amount: amount,
        contributionId: contributionId,
        description: `Deposit to ${contribution.name}`,
        reference: tx_ref,
        status: 'completed',
        paymentMethod: 'flutterwave'
      });

      // Update user balance
      const user = getBaseCurrentUser();
      if (user && user.id === contribution.creatorId) {
        updateUserBalance(user.id, user.walletBalance + amount);
      }

      // Create notification
      const notificationsString = localStorage.getItem('notifications');
      const notifications = notificationsString ? JSON.parse(notificationsString) : [];
      
      const newNotification = {
        id: crypto.randomUUID(),
        createdAt: timestamp,
        userId: contribution.creatorId,
        message: `Your deposit of ₦${amount.toLocaleString()} to ${contribution.name} was successful`,
        isRead: false,
        relatedId: contributionId
      };

      notifications.push(newNotification);
      localStorage.setItem('notifications', JSON.stringify(notifications));

      return res.status(200).json({ success: true, message: 'Webhook processed successfully' });
    }

    return res.status(400).json({ success: false, message: 'Invalid webhook type' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
} 