
import type { NextApiRequest, NextApiResponse } from 'next';
import { SECRET_KEY as FLUTTERWAVE_SECRET_KEY } from '@/services/flutterwave/config';

// This is a simple proxy to the Flutterwave API to avoid exposing the secret key on the client
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Get the path from the URL
    const { path } = req.query;
    if (!path || !Array.isArray(path)) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Invalid path' 
      });
    }
    
    // Build the full path to the Flutterwave API
    const flutterwavePath = path.join('/');
    const url = `https://api.flutterwave.com/v3/${flutterwavePath}`;
    
    console.log(`Proxying request to Flutterwave: ${req.method} ${url}`);
    
    // Forward the request to Flutterwave
    const flutterwaveResponse = await fetch(url, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });
    
    // Extract the data from the response
    let data;
    try {
      data = await flutterwaveResponse.json();
    } catch (e) {
      console.error('Failed to parse Flutterwave response:', e);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to parse Flutterwave response'
      });
    }
    
    // Log the response for debugging
    console.log(`Flutterwave API response status: ${flutterwaveResponse.status}`);
    
    // Forward the response
    return res.status(flutterwaveResponse.status).json(data);
  } catch (error) {
    console.error('Error in Flutterwave proxy:', error);
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}
