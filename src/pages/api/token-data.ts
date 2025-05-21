import type { NextApiRequest, NextApiResponse } from 'next';
import { dexScreenerService } from '../../services/dexScreenerService';

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
    const { mintAddress, poolAddress, transactionLogs, userWallet } = req.body;

    // Require at least mint address or pool address
    if (!mintAddress && !poolAddress) {
      return res.status(400).json({ error: 'Missing mintAddress or poolAddress parameter' });
    }

    // Case 1: Pool address is directly provided
    if (poolAddress) {
      console.log(`API: Fetching token data from pool ${poolAddress}`);
      
      // Get token data from DexScreener using the pool address
      const pairData = await dexScreenerService.fetchPairData(poolAddress);
      
      // Return the data - pool data is always less reliable
      return res.status(200).json({
        marketCap: pairData.marketCap || undefined,
        priceUsd: pairData.priceUsd || undefined,
        isReliable: false // Pool data is less reliable
      });
    }
    
    // Case 2: Only mint address is provided
    console.log(`API: Fetching token data for ${mintAddress}`);
    
    // Get token data from DexScreener
    const tokenData = await dexScreenerService.fetchTokenData(
      mintAddress, 
      transactionLogs,
      userWallet // Pass user wallet to avoid misidentifying as pool
    );
    
    // Only include reliable market cap data
    const marketCap = tokenData.isReliable ? tokenData.marketCap || undefined : undefined;
    
    // Return the data
    return res.status(200).json({
      marketCap,
      priceUsd: tokenData.priceUsd || undefined,
      isReliable: tokenData.isReliable
    });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Failed to fetch token data' });
  }
} 