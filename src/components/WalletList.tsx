import { useState, useEffect } from 'react';
import { getTrackedWallets, removeTrackedWallet, updateTrackedWallet, TrackedWallet } from '../utils/userProfile';
import { useWalletSelection } from '../contexts/WalletSelectionContext';

interface WalletListProps {
  userId: string;
  onAddWallet: () => void;
}

const WalletList = ({ userId, onAddWallet }: WalletListProps) => {
  const [wallets, setWallets] = useState<TrackedWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [walletToDelete, setWalletToDelete] = useState<TrackedWallet | null>(null);
  const { reloadWallets } = useWalletSelection();
  const MAX_WALLETS = 3;

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

        // Update the WalletSelectionContext
        await reloadWallets();
      }
    } catch (err) {
      console.error('Failed to remove wallet:', err);
      setError('Failed to remove wallet. Please try again.');
    } finally {
      setIsRemoving(null);
    }
  };

  const handleEditWallet = (wallet: TrackedWallet) => {
    setEditingWalletId(wallet.id);
    setNewLabel(wallet.label || 'My Wallet');
  };

  const handleUpdateWallet = async (walletId: string) => {
    if (!newLabel.trim()) {
      setNewLabel('My Wallet');
      return;
    }

    try {
      setIsUpdating(true);
      const success = await updateTrackedWallet(walletId, newLabel);

      if (success) {
        // Update the local state without re-fetching
        setWallets(wallets.map(wallet => 
          wallet.id === walletId ? { ...wallet, label: newLabel } : wallet
        ));
        setEditingWalletId(null);
      }
    } catch (err) {
      console.error('Failed to update wallet:', err);
      setError('Failed to update wallet. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingWalletId(null);
    setNewLabel('');
  };

  const handleDeleteClick = (wallet: TrackedWallet) => {
    setWalletToDelete(wallet);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!walletToDelete) return;
    
    setShowDeleteConfirm(false);
    await handleRemoveWallet(walletToDelete.id);
    setWalletToDelete(null);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setWalletToDelete(null);
  };

  if (loading) {
    return (
      <div className="bg-[#1a1a1a] p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-3 text-indigo-200">Your Wallets (0/{MAX_WALLETS})</h2>
        <div className="text-gray-400">Loading wallet information...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#1a1a1a] p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-3 text-indigo-200">Your Wallets ({wallets.length}/{MAX_WALLETS})</h2>
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
        <h2 className="text-xl font-semibold text-indigo-200">Your Wallets ({wallets.length}/{MAX_WALLETS})</h2>
        <button 
          onClick={onAddWallet}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition text-sm"
          disabled={wallets.length >= MAX_WALLETS}
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
              <div className="flex-grow">
                {editingWalletId === wallet.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      className="bg-[#2a2a2a] text-white px-2 py-1 rounded border border-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full"
                      disabled={isUpdating}
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleUpdateWallet(wallet.id)}
                        disabled={isUpdating}
                        className="p-1 text-green-400 hover:text-green-300 disabled:opacity-50"
                        aria-label="Save wallet name"
                      >
                        {isUpdating ? '...' : '✓'}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={isUpdating}
                        className="p-1 text-gray-400 hover:text-gray-300 disabled:opacity-50"
                        aria-label="Cancel editing"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="font-medium text-white flex items-center gap-2">
                      {wallet.label || 'My Wallet'}
                      <button
                        onClick={() => handleEditWallet(wallet)}
                        className="text-gray-400 hover:text-indigo-300"
                        aria-label="Edit wallet name"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>
                    <div className="text-gray-400 text-sm truncate max-w-[220px] md:max-w-md">
                      {wallet.wallet_address}
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => handleDeleteClick(wallet)}
                disabled={isRemoving === wallet.id || editingWalletId === wallet.id}
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

      {/* Delete confirmation modal */}
      {showDeleteConfirm && walletToDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#23232b] rounded-lg shadow-lg p-5 sm:p-8 max-w-md w-full border border-red-700">
            <h3 className="text-lg font-bold text-red-400 mb-4">Delete Wallet?</h3>
            <p className="text-gray-300 mb-4">
              Are you sure you want to delete <span className="font-medium text-white">"{walletToDelete.label || 'My Wallet'}"</span>?
            </p>
            <div className="bg-red-900/30 border border-red-500 rounded-md p-3 mb-6">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-red-200 font-medium text-sm mb-1">This action cannot be undone!</p>
                  <p className="text-red-300 text-sm">All trading history, trade notes, and analysis data for this wallet will be permanently deleted.</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition order-2 sm:order-1"
                onClick={handleCancelDelete}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition font-semibold order-1 sm:order-2"
                onClick={handleConfirmDelete}
              >
                Delete Wallet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletList; 
