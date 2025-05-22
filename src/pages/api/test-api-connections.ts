import { NextApiRequest, NextApiResponse } from 'next';
import { drpcClient } from '../../services/drpcClient';
import { jupiterApiService } from '../../services/jupiterApiService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Test DRPC connection
    const testWallet = '9YbZpnB5AqY9PzHHC4s8vQgQjD3dacx6SYNd88qbev9p'; // Example wallet address
    const drpcResult = await drpcClient.getTransactions(testWallet, 1);
    
    // Test Jupiter API connections
    const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC token
    const solMint = 'So11111111111111111111111111111111111111112'; // SOL token
    
    const [usdcInfo, solInfo, usdcPrice, solPrice] = await Promise.all([
      jupiterApiService.getTokenInfo(usdcMint).catch(err => ({ error: err.message })),
      jupiterApiService.getTokenInfo(solMint).catch(err => ({ error: err.message })),
      jupiterApiService.getTokenPrice(usdcMint).catch(err => ({ error: err.message })),
      jupiterApiService.getTokenPrice(solMint).catch(err => ({ error: err.message }))
    ]);
    
    res.status(200).json({
      success: true,
      results: {
        drpc: {
          success: !!drpcResult,
          transactionsFound: drpcResult.transactions.length
        },
        jupiter: {
          usdcInfo,
          solInfo,
          usdcPrice,
          solPrice
        }
      }
    });
  } catch (error: any) {
    console.error('API test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
} 