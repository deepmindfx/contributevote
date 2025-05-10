import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import { prisma } from '@/lib/prisma';
import { Flutterwave } from 'flutterwave-node-v3';

const flw = new Flutterwave(
  process.env.FLUTTERWAVE_PUBLIC_KEY!,
  process.env.FLUTTERWAVE_SECRET_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const session = await getSession({ req });
    if (!session) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { amount, accountNumber, bankCode, beneficiaryName, currency, narration } = req.body;

    // Validate required fields
    if (!amount || !accountNumber || !bankCode || !beneficiaryName || !currency) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Get user's wallet balance
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { wallet: true }
    });

    if (!user?.wallet) {
      return res.status(400).json({ message: 'Wallet not found' });
    }

    // Check if user has sufficient balance
    if (user.wallet.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
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
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/transfer`,
      debit_currency: currency,
      beneficiary_name: beneficiaryName
    };

    // Initiate transfer
    const transfer = await flw.Transfer.initiate(transferPayload);

    if (transfer.status === 'error') {
      return res.status(400).json({ message: transfer.message });
    }

    // Create transfer record in database
    const transferRecord = await prisma.transfer.create({
      data: {
        userId: user.id,
        amount: amount,
        currency: currency,
        status: 'PENDING',
        reference: reference,
        recipientAccount: accountNumber,
        recipientBank: bankCode,
        recipientName: beneficiaryName,
        narration: narration
      }
    });

    // Deduct amount from user's wallet
    await prisma.wallet.update({
      where: { id: user.wallet.id },
      data: {
        balance: {
          decrement: amount
        }
      }
    });

    return res.status(200).json({
      message: 'Transfer initiated successfully',
      data: {
        transferId: transferRecord.id,
        reference: reference,
        status: 'PENDING'
      }
    });

  } catch (error: any) {
    console.error('Transfer error:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
} 