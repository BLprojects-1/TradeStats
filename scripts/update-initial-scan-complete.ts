import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const WALLET_ADDRESS = 'LT42y5yGt13TJUR8iLBu3y37PPYAB32GzDhMCQvJvEX';

// Validate environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

interface WalletData {
  user_id: string;
}

async function updateInitialScanComplete() {
  try {
    // 1. First get the user_id for this wallet
    console.log('Getting user_id for wallet:', WALLET_ADDRESS);
    const { data: walletData, error: fetchError } = await supabase
      .from('tracked_wallets')
      .select('user_id')
      .eq('wallet_address', WALLET_ADDRESS)
      .single();

    if (fetchError) {
      console.error('Error fetching wallet data:', fetchError);
      process.exit(1);
    }

    if (!walletData) {
      console.error('Wallet not found in tracked_wallets');
      process.exit(1);
    }

    const userId = walletData.user_id;
    console.log('Found user_id:', userId);

    // 2. Now update initial_scan_complete using both wallet_address and user_id
    console.log('Updating initial_scan_complete...');
    const { data, error } = await supabase
      .from('tracked_wallets')
      .update({ 
        initial_scan_complete: true, 
        updated_at: new Date().toISOString() 
      })
      .eq('wallet_address', WALLET_ADDRESS)
      .eq('user_id', userId)
      .select();

    if (error) {
      console.error('Error updating initial_scan_complete:', error);
      process.exit(1);
    }

    console.log('Successfully updated initial_scan_complete:', data);
    process.exit(0);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

updateInitialScanComplete(); 