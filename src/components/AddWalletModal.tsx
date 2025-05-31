import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useWalletSelection } from '../contexts/WalletSelectionContext';
import ScanningNotification from './ScanningNotification';

interface AddWalletModalProps {
  userId: string;
  onClose: () => void;
  onSuccess: (wallet: any) => void;
}

export default function AddWalletModal({ userId, onClose, onSuccess }: AddWalletModalProps) {
  const [walletAddress, setWalletAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showScanning, setShowScanning] = useState(false);
  const { wallets, reloadWallets } = useWalletSelection();

  const startWalletScan = async (walletId: string, address: string) => {
    try {
      console.log('🔄 Client: Starting wallet scan for:', { walletId, address });

      const response = await fetch('/api/wallets/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          walletAddress: address
        })
      });

      console.log('📡 Client: Received response:', { status: response.status });
      const data = await response.json();
      console.log('📦 Client: Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start wallet scan');
      }

      console.log('✅ Client: Wallet scan completed:', data);

      // Update scanning state in localStorage
      const scanningWallets = JSON.parse(localStorage.getItem('scanning_wallets') || '[]');
      const updatedWallets = scanningWallets.filter((w: string) => w !== address);
      localStorage.setItem('scanning_wallets', JSON.stringify(updatedWallets));

      // Reload wallets to get updated status
      await reloadWallets();

      // Close scanning notification
      setShowScanning(false);

      return data;
    } catch (error) {
      console.error('❌ Client: Error scanning wallet:', error);
      // Remove from scanning list on error
      const scanningWallets = JSON.parse(localStorage.getItem('scanning_wallets') || '[]');
      const updatedWallets = scanningWallets.filter((w: string) => w !== address);
      localStorage.setItem('scanning_wallets', JSON.stringify(updatedWallets));

      // Show error in UI
      setError(error instanceof Error ? error.message : 'Failed to scan wallet');
      setSaving(false);
      setShowScanning(false);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check wallet limit
    if (wallets.length >= 3) {
      setError('Maximum of 3 wallets allowed');
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
        console.log('Wallet previously existed, attempting upsert operation');

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

      // Show scanning notification
      setShowScanning(true);

      // Store scanning state in localStorage
      const scanningWallets = JSON.parse(localStorage.getItem('scanning_wallets') || '[]');
      if (!scanningWallets.includes(walletAddress.trim())) {
        scanningWallets.push(walletAddress.trim());
        localStorage.setItem('scanning_wallets', JSON.stringify(scanningWallets));
      }

      // Close modal and show success immediately
      onSuccess(newWallet);
      onClose();

      // We no longer start the scan process in the background
      // The user will explicitly start it by clicking "Start Scan" in the ScanTradesModal

    } catch (err: any) {
      console.error('Error adding wallet:', err);
      setError(err.message || 'Failed to add wallet. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl border border-indigo-500/40 rounded-3xl shadow-2xl shadow-indigo-900/20 max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-indigo-500/20">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/30">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Add Wallet</h2>
          </div>
          <button
            onClick={onClose}
            className="p-3 rounded-xl bg-slate-800/50 border border-indigo-500/30 hover:bg-slate-700/50 hover:border-indigo-500/50 text-gray-400 hover:text-gray-200 transition-all duration-300 group"
            aria-label="Close modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {showScanning ? (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                <svg className="animate-spin h-10 w-10 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 animate-pulse"></div>
              </div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-3">Scanning Wallet</h3>
              <p className="text-gray-300 text-sm mb-6">We're analyzing your trading history...</p>
              <div className="flex items-center justify-center space-x-2 text-xs text-gray-400 bg-gradient-to-r from-indigo-900/20 to-purple-900/20 rounded-xl p-3 border border-indigo-500/20">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>This may take up to 2 minutes</span>
              </div>
            </div>
          ) : (
            <>
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
                  <label htmlFor="walletAddress" className="block text-sm font-medium text-indigo-300 mb-2">
                    Solana Wallet Address
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="walletAddress"
                      value={walletAddress}
                      onChange={(e) => setWalletAddress(e.target.value)}
                      placeholder="Enter your Solana wallet address"
                      disabled={saving}
                      className="w-full px-4 py-3 bg-gradient-to-br from-[#1a1a2e]/80 to-[#1a1a28]/80 backdrop-blur-sm border border-indigo-500/30 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      required
                    />
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-500/5 to-purple-500/5 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                  </div>
                  <p className="mt-2 text-xs text-gray-500 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    We'll scan this wallet for trading history and portfolio data
                  </p>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-3 text-sm font-medium text-gray-400 hover:text-white transition-colors rounded-xl hover:bg-gray-800/30"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !walletAddress.trim()}
                    className="px-6 py-3 text-sm font-medium bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl shadow-lg shadow-indigo-900/30 hover:from-indigo-500 hover:to-purple-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100"
                  >
                    {saving ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Adding Wallet...
                      </span>
                    ) : 'Add Wallet'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>

      {showScanning && (
        <ScanningNotification
          walletAddress={walletAddress}
          onClose={() => setShowScanning(false)}
        />
      )}
    </div>
  );
} 
