import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { userId, walletAddress } = await request.json();

    if (!userId || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('🔍 API: checking tracked_wallets for', { userId, walletAddress });

    // First verify the wallet exists
    const { data: found, error: findErr } = await supabaseAdmin
      .from('tracked_wallets')
      .select('id, user_id, wallet_address, initial_scan_complete')
      .eq('user_id', userId)
      .eq('wallet_address', walletAddress);

    console.log('🔎 API: lookup result:', { found, findErr });

    if (findErr) {
      console.error('❌ API: LOOKUP ERROR:', findErr);
      return NextResponse.json(
        { error: findErr.message },
        { status: 500 }
      );
    }

    if (!found || found.length === 0) {
      console.error('❌ API: NO ROW FOUND:', { userId, walletAddress });
      return NextResponse.json(
        { error: `No row found for user=${userId} wallet=${walletAddress}` },
        { status: 404 }
      );
    }

    // Attempt the update
    console.log('🔄 API: Attempting update...');
    const { data, error } = await supabaseAdmin
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

    console.log('📝 API: update response:', { data, error });

    if (error) {
      console.error('❌ API: UPDATE ERROR:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      console.error('❌ API: UPDATE RETURNED NULL');
      return NextResponse.json(
        { error: 'Update failed - no data returned' },
        { status: 500 }
      );
    }

    console.log('✅ API: UPDATE SUCCEEDED:', data);
    return NextResponse.json({ success: true, data });

  } catch (error) {
    console.error('💥 API: CRITICAL ERROR:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
