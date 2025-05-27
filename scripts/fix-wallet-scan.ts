import { supabase } from '../src/utils/supabaseClient';

async function fixWalletScan() {
  try {
    // Update the tracked_wallets table to set initial_scan_complete
    const { data, error } = await supabase
      .from('tracked_wallets')
      .update({ 
        initial_scan_complete: true,
        updated_at: new Date().toISOString()
      })
      .eq('wallet_address', 'LT42y5yGt13TJUR8iLBu3y37PPYAB32GzDhMCQvJvEX')
      .select()
      .single();

    if (error) {
      console.error('Error updating wallet scan status:', error);
      process.exit(1);
    }

    console.log('Successfully updated wallet scan status:', data);
    process.exit(0);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

// Run the fix
fixWalletScan(); 