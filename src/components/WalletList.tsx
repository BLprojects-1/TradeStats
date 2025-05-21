import { useState, useEffect } from 'react';
import { getTrackedWallets, removeTrackedWallet, TrackedWallet } from '../utils/userProfile';

interface WalletListProps {
  userId: string;
  onAddWallet: () => void;
}

const WalletList = ({ userId, onAddWallet }: WalletListProps) => {
  const [wallets, setWallets] = useState<TrackedWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);

  const fetchWallets = async () => {
    try {
      setLoading(true);
      const data = await getTrackedWallets(userId);
      setWallets(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching wallets:', err);
      setError('Unable to load your wallet information. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchWallets();
    }
  }, [userId]);

  const handleRemoveWallet = async (walletId: string) => {
    try {
      setIsRemoving(walletId);
      const success = await removeTrackedWallet(walletId);
      
      if (success) {
        // Update the local state without re-fetching
        setWallets(wallets.filter(wallet => wallet.id !== walletId));
      }
    } catch (err) {
      console.error('Failed to remove wallet:', err);
      setError('Failed to remove wallet. Please try again.');
    } finally {
      setIsRemoving(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#1a1a1a] p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-3 text-indigo-200">Your Wallets</h2>
        <div className="text-gray-400">Loading wallet information...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#1a1a1a] p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-3 text-indigo-200">Your Wallets</h2>
        <div className="text-red-400">{error}</div>
        <button 
          onClick={fetchWallets}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a1a] p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-indigo-200">Your Wallets</h2>
        <button 
          onClick={onAddWallet}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition text-sm"
        >
          Add Wallet
        </button>
      </div>
      
      {wallets.length === 0 ? (
        <div className="text-gray-400">You haven't added any wallets yet.</div>
      ) : (
        <div className="space-y-3">
          {wallets.map(wallet => (
            <div 
              key={wallet.id} 
              className="flex items-center justify-between bg-[#212121] p-3 rounded-lg border border-gray-800"
            >
              <div>
                <div className="font-medium text-white">{wallet.label || 'My Wallet'}</div>
                <div className="text-gray-400 text-sm truncate max-w-[220px] md:max-w-md">
                  {wallet.wallet_address}
                </div>
              </div>
              <button
                onClick={() => handleRemoveWallet(wallet.id)}
                disabled={isRemoving === wallet.id}
                className="p-2 text-gray-400 hover:text-red-400 disabled:opacity-50"
                aria-label="Remove wallet"
              >
                {isRemoving === wallet.id ? 
                  <span className="text-xs">Removing...</span> : 
                  <span>✕</span>
                }
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WalletList; 