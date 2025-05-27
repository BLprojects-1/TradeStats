import { NextApiRequest, NextApiResponse } from 'next';
import { historicalPriceService } from '../../../services/historicalPriceService';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const config = {
  maxDuration: 300, // Set maximum duration to 5 minutes
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, walletAddress } = req.body;

  if (!userId || !walletAddress) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Immediately return a 202 Accepted response
  res.status(202).json({ message: 'Scan started' });

  try {
    // Update scan status in Supabase
    await supabaseAdmin
      .from('tracked_wallets')
      .update({ 
        scan_status: 'scanning',
        scan_started_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('wallet_address', walletAddress);

    // Start the historical price analysis
    const result = await historicalPriceService.analyzeWalletTrades(walletAddress);

    // Update scan status with results
    await supabaseAdmin
      .from('tracked_wallets')
      .update({ 
        scan_status: 'completed',
        scan_completed_at: new Date().toISOString(),
        initial_scan_complete: true,
        trades_found: result.totalTrades,
        unique_tokens: result.uniqueTokens.size
      })
      .eq('user_id', userId)
      .eq('wallet_address', walletAddress);

  } catch (error: any) {
    console.error('Scan failed:', error);

    // Update scan status with error
    await supabaseAdmin
      .from('tracked_wallets')
      .update({ 
        scan_status: 'failed',
        scan_error: error.message,
        scan_completed_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('wallet_address', walletAddress);
  }
} 