import { NextResponse } from 'next/server';
import { historicalPriceService } from '../../../../services/historicalPriceService';
import { supabase } from '../../../../utils/supabaseClient';

export async function POST(request: Request) {
  try {
    const { userId, walletAddress } = await request.json();

    if (!userId || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('🚀 Starting Historical Pricing Analysis');
    console.log('Wallet:', walletAddress);

    // Get the cutoff time (24 hours ago)
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    console.log('\n⏰ Cutoff time (24h ago):', cutoffTime.toISOString());

    // Start the deep scan
    console.log('\n🔍 Deep scanning account:', walletAddress);
    const analysisResult = await historicalPriceService.analyzeWalletTrades(walletAddress);

    // Update the wallet's initial_scan_complete status
    const { error: updateError } = await supabase
      .from('tracked_wallets')
      .update({ initial_scan_complete: true })
      .eq('wallet_address', walletAddress)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating wallet status:', updateError);
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: 'Historical pricing analysis completed',
      analysisResult
    });

  } catch (error) {
    console.error('Error in historical pricing analysis:', error);
    return NextResponse.json(
      { error: 'Failed to complete historical pricing analysis' },
      { status: 500 }
    );
  }
} 