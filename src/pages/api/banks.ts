import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import { Flutterwave } from 'flutterwave-node-v3';

const flw = new Flutterwave(
  process.env.FLUTTERWAVE_PUBLIC_KEY!,
  process.env.FLUTTERWAVE_SECRET_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const session = await getSession({ req });
    if (!session) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const banks = await flw.Bank.getBanks();
    
    if (banks.status === 'error') {
      throw new Error(banks.message);
    }

    return res.status(200).json({
      status: 'success',
      data: banks.data
    });
  } catch (error: any) {
    console.error('Banks fetch error:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
} 