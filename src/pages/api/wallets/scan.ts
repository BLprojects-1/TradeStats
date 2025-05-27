import { NextApiRequest, NextApiResponse } from 'next';
import { historicalPriceService } from '../../../services/historicalPriceService';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, walletAddress } = req.body;

    if (!userId || !walletAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log('🔍 API: Starting wallet scan for:', { userId, walletAddress });

    try {
      // Start the historical price analysis
      console.log('🚀 API: Starting Historical Price Analysis');
      const result = await historicalPriceService.analyzeWalletTrades(walletAddress);
      console.log('✅ API: Historical price analysis completed:', {
        trades: result.totalTrades,
        uniqueTokens: result.uniqueTokens.size
      });

      // Mark the wallet as scanned
      console.log('📝 API: Marking wallet as scanned...');
      const { data: wallet } = await supabaseAdmin
        .from('tracked_wallets')
        .update({ 
          initial_scan_complete: true
          // Don't update updated_at here, let the database handle it
          // or let cacheTrades update it with the most recent transaction timestamp
        })
        .eq('user_id', userId)
        .eq('wallet_address', walletAddress)
        .select()
        .single();
      console.log('✅ API: Wallet marked as scanned');

      console.log('✅ API: Scan completed successfully:', {
        tradesFound: result.totalTrades,
        uniqueTokens: result.uniqueTokens.size,
        wallet
      });

      return res.json({
        success: true,
        tradesFound: result.totalTrades,
        uniqueTokens: result.uniqueTokens.size,
        wallet
      });
    } catch (error: any) {
      console.error('❌ API: Scan failed:', error);

      // Update wallet status to failed
      await supabaseAdmin
        .from('tracked_wallets')
        .update({ 
          initial_scan_complete: false,
          scan_error: error.message
          // Don't update updated_at here, let the database handle it
          // or let cacheTrades update it with the most recent transaction timestamp
        })
        .eq('user_id', userId)
        .eq('wallet_address', walletAddress);

      throw error;
    }
  } catch (error: any) {
    console.error('❌ API: Error in scan handler:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to scan wallet'
    });
  }
} 
