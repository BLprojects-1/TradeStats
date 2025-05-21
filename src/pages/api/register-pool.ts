import type { NextApiRequest, NextApiResponse } from 'next';
import { dexScreenerService } from '../../services/dexScreenerService';

type RegisterPoolResponse = {
  success: boolean;
  error?: string;
  data?: {
    mintAddress: string;
    poolAddress: string;
    priceUsd?: number;
    marketCap?: number;
  };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RegisterPoolResponse>
) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { mintAddress, poolAddress } = req.body;

    if (!mintAddress || !poolAddress) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters: mintAddress and poolAddress' 
      });
    }

    // Validate addresses (very basic check)
    if (mintAddress.length < 32 || poolAddress.length < 32) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid address format' 
      });
    }

    console.log(`API: Registering pool ${poolAddress} for token ${mintAddress}`);
    
    // First verify that the pool address is valid by fetching data
    const pairData = await dexScreenerService.fetchPairData(poolAddress);
    
    if (!pairData.priceUsd) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pool address: No price data found. Verify the pool address is correct.'
      });
    }
    
    // Register the pool
    dexScreenerService.registerTokenPool(mintAddress, poolAddress);
    
    // Return success with the fetched data
    return res.status(200).json({
      success: true,
      data: {
        mintAddress,
        poolAddress,
        priceUsd: pairData.priceUsd,
        marketCap: pairData.marketCap || undefined
      }
    });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to register pool' 
    });
  }
} 