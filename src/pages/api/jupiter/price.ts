import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

interface JupiterQuoteResponse {
  outAmount: string;
  inAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: number;
  platformFee: unknown;
  routePlan: unknown[];
  contextSlot: number;
  timeTaken: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { inputMint, blockTime } = req.query;

  if (!inputMint || !blockTime) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    // Use USDC as output mint for price calculations
    const outputMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const amount = '10000000000'; // Use a fixed amount for price calculation
    const slippageBps = '100';

    const response = await axios.get<JupiterQuoteResponse>(
      `https://quote-api.jup.ag/v5/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&blockTime=${blockTime}`,
      {
        headers: {
          'Accept': 'application/json',
        },
        timeout: 10000 // 10 second timeout
      }
    );

    // Check if we have valid data
    if (!response.data || !response.data.outAmount) {
      console.error('Invalid response from Jupiter API:', response.data);
      return res.status(500).json({ error: 'Invalid response from Jupiter API' });
    }

    // Calculate price in USDC (6 decimals)
    const priceUsd = Number(response.data.outAmount) / Math.pow(10, 6);

    return res.status(200).json({
      outAmount: response.data.outAmount,
      inAmount: response.data.inAmount,
      priceUsd
    });
  } catch (error: any) {
    console.error('Error fetching Jupiter price:', error);
    
    // Handle specific error cases
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Jupiter API error response:', {
        status: error.response.status,
        data: error.response.data
      });
      return res.status(error.response.status).json({
        error: 'Jupiter API error',
        details: error.response.data
      });
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response from Jupiter API:', error.request);
      return res.status(504).json({
        error: 'Jupiter API timeout',
        details: 'No response received from Jupiter API'
      });
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error setting up request:', error.message);
      return res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  }
} 