require('cross-fetch/polyfill');
const { createClient } = require('@supabase/supabase-js');

const WALLET_ADDRESS = 'LT42y5yGt13TJUR8iLBu3y37PPYAB32GzDhMCQvJvEX';

// Initialize Supabase client
const supabase = createClient(
  'https://aqxqvzqwxvxvxvxvxv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxeHF2enF3eHZ4dnhieHZ4diIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2OTk2NDQ2NDQsImV4cCI6MjAxNTIyMDY0NH0.7h8bkjqwqjqwqjqwqjqwqjqwqjqwqjqwqjqwqjqw',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

async function testUpdateInitialScanComplete() {
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

testUpdateInitialScanComplete(); 