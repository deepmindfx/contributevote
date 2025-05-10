import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Get the secret hash from environment variable
  const secretHash = import.meta.env.VITE_FLW_SECRET_HASH;
  
  // Log the value (this will only show in server console)
  console.log('Secret Hash from env:', secretHash);
  
  // Return the value (masked for security)
  res.status(200).json({
    success: true,
    message: 'Environment variable check',
    hasSecretHash: !!secretHash,
    secretHashLength: secretHash ? secretHash.length : 0,
    // Show first 4 and last 4 characters for verification
    maskedHash: secretHash ? 
      `${secretHash.substring(0, 4)}...${secretHash.substring(secretHash.length - 4)}` : 
      'Not found'
  });
} 