import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Verify webhook signature
    const secret = process.env.FLUTTERWAVE_SECRET_HASH!;
    const signature = req.headers['verif-hash'];
    
    if (!signature || signature !== secret) {
      return res.status(401).json({ message: 'Invalid signature' });
    }

    const { event, data } = req.body;

    if (event === 'transfer.completed') {
      const { reference, status } = data;

      // Update transfer status in database
      await prisma.transfer.update({
        where: { reference },
        data: {
          status: status === 'SUCCESSFUL' ? 'COMPLETED' : 'FAILED',
          completedAt: new Date(),
          metadata: data
        }
      });

      // If transfer failed, refund the user
      if (status !== 'SUCCESSFUL') {
        const transfer = await prisma.transfer.findUnique({
          where: { reference },
          include: { user: { include: { wallet: true } } }
        });

        if (transfer && transfer.user?.wallet) {
          await prisma.wallet.update({
            where: { id: transfer.user.wallet.id },
            data: {
              balance: {
                increment: transfer.amount
              }
            }
          });
        }
      }
    }

    return res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (error: any) {
    console.error('Transfer webhook error:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
} 