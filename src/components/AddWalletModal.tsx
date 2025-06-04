import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useWalletSelection } from '../contexts/WalletSelectionContext';
import WalletScanModal from './WalletScanModal';

interface AddWalletModalProps {
  userId: string;
  onClose: () => void;
  onSuccess: (wallet: any) => void;
}

export default function AddWalletModal({ userId, onClose, onSuccess }: AddWalletModalProps) {
  const [walletAddress, setWalletAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [addedWallet, setAddedWallet] = useState<any>(null);
  const { wallets, reloadWallets } = useWalletSelection();

  const handleScanSuccess = (result: { newTradesCount: number, message: string }) => {
    // Close the scan modal
    setShowScanModal(false);
    
    // Call the original onSuccess callback
    onSuccess(addedWallet);
    
    // Close the add wallet modal
    onClose();
  };

  const handleScanModalClose = () => {
    // If user closes scan modal without scanning, still close everything
    setShowScanModal(false);
    onSuccess(addedWallet);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check wallet limit
    if (wallets.length >= 3) {
      setError('Maximum of 3 wallets allowed in TradeStats');
      return;
    }

    if (!walletAddress.trim()) {
      setError('Wallet address is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Try to add wallet with initial_scan_complete set to false
      let { data: newWallet, error: walletError } = await supabase
        .from('tracked_wallets')
        .insert({
          user_id: userId,
          wallet_address: walletAddress.trim(),
          initial_scan_complete: false // Set to false initially
        })
        .select()
        .single();

      // If we get a unique constraint violation, it means the wallet was previously added and deleted
      // In this case, we'll use upsert to update the existing record
      if (walletError && walletError.code === '23505') {
        console.log('Wallet previously existed in TradeStats, attempting upsert operation');

        // Use upsert operation to update the existing record
        const { data: upsertedWallet, error: upsertError } = await supabase
          .from('tracked_wallets')
          .upsert({
            user_id: userId,
            wallet_address: walletAddress.trim(),
            initial_scan_complete: false
          })
          .select()
          .single();

        if (upsertError) throw upsertError;
        newWallet = upsertedWallet;
      } else if (walletError) {
        throw walletError;
      }

      // Immediately reload wallets to show the new one
      await reloadWallets();

      // Store the added wallet and show scan modal
      setAddedWallet(newWallet);
      setShowScanModal(true);

    } catch (err: any) {
      console.error('Error adding wallet to TradeStats:', err);
      setError(err.message || 'Failed to add wallet to TradeStats. Please try again.');
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[9999] w-full max-w-md">
        <div className="relative bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-950 border border-emerald-400/40 rounded-3xl shadow-2xl shadow-emerald-900/30 w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-emerald-400/20">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 via-teal-600 to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/40 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-teal-400/20 to-amber-400/20 animate-pulse"></div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-300 via-teal-300 to-amber-300 bg-clip-text text-transparent">Add Wallet to TradeStats</h2>
            </div>
            <button
              onClick={onClose}
              className="p-3 rounded-xl bg-slate-800/50 border border-emerald-400/30 hover:bg-slate-700/50 hover:border-emerald-400/50 text-emerald-400 hover:text-emerald-300 transition-all duration-300 group"
              aria-label="Close modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {error && (
              <div className="mb-4 p-4 bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 text-red-200 text-sm rounded-xl flex items-center shadow-lg shadow-red-500/10">
                <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="walletAddress" className="block text-sm font-semibold text-emerald-300 mb-3">
                  Solana Wallet Address
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="walletAddress"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    placeholder="Enter your Solana wallet address for TradeStats"
                    disabled={saving}
                    className="w-full px-4 py-3 bg-gradient-to-br from-slate-800/80 via-emerald-950/80 to-teal-950/80 backdrop-blur-sm border border-emerald-400/30 rounded-xl text-white placeholder-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    required
                  />
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-400/5 to-teal-400/5 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                </div>
                <p className="mt-2 text-xs text-emerald-400/80 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  TradeStats will scan this wallet for trading history and portfolio data
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 text-sm font-medium text-emerald-400/80 hover:text-emerald-300 transition-colors rounded-xl hover:bg-emerald-800/20"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !walletAddress.trim()}
                  className="group relative overflow-hidden px-6 py-3 text-sm font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-amber-600 text-white rounded-xl shadow-lg shadow-emerald-500/30 hover:from-emerald-500 hover:via-teal-500 hover:to-amber-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100"
                >
                  {/* Animated background */}
                  <div className="absolute inset-0 bg-gradient-to-r from-teal-400/20 to-amber-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  
                  <span className="relative">
                    {saving ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Adding to TradeStats...
                      </span>
                    ) : 'Add to TradeStats'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Wallet Scan Modal */}
      {showScanModal && addedWallet && (
        <WalletScanModal
          isOpen={showScanModal}
          onClose={handleScanModalClose}
          onSuccess={handleScanSuccess}
          walletAddress={walletAddress.trim()}
          userId={userId}
        />
      )}
    </>
  );
} 
