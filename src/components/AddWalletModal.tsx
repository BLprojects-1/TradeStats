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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-[#1a1a1a] rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-semibold text-white mb-4">Add New Wallet</h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Wallet Address
            </label>
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              className="w-full bg-[#252525] text-white border border-gray-700 rounded-lg p-2 focus:outline-none focus:border-indigo-500"
              placeholder="Enter Solana wallet address"
            />
          </div>

          {error && (
            <div className="mb-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`
                px-4 py-2 rounded-lg
                ${saving
                  ? 'bg-indigo-800 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700'
                }
                transition-colors
              `}
            >
              {saving ? 'Adding...' : 'Add Wallet'}
            </button>
          </div>
        </form>
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
