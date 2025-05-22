import type { NextApiRequest, NextApiResponse } from 'next';

type TokenDataResponse = {
  marketCap?: number;
  priceUsd?: number;
  isReliable?: boolean;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TokenDataResponse>
) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { mintAddress, poolAddress } = req.body;

    // Require at least mint address or pool address
    if (!mintAddress && !poolAddress) {
      return res.status(400).json({ error: 'Missing mintAddress or poolAddress parameter' });
    }

    console.log(`API: Token data request for ${mintAddress || poolAddress}`);
    
    // Since dexScreenerService is no longer used, return a placeholder response
    return res.status(200).json({
      isReliable: false,
      error: 'Token price data service currently unavailable'
    });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Failed to fetch token data' });
  }
} 