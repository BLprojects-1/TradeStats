import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-200">Your Wallets (0/{MAX_WALLETS})</h3>
        </div>
        <div className="text-gray-400 py-8 text-center">
          <div className="animate-pulse">Loading wallet information...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-200">Your Wallets ({wallets.length}/{MAX_WALLETS})</h3>
        </div>
        <div className="bg-gradient-to-r from-red-900/30 to-red-800/30 backdrop-blur-sm border border-red-500/30 text-red-200 px-6 py-4 rounded-xl shadow-lg shadow-red-900/10">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
          <button 
            onClick={fetchWallets}
            className="mt-3 px-4 py-2 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-xl hover:from-red-500 hover:to-red-400 transition-all duration-300 transform hover:scale-105 shadow-lg shadow-red-900/15"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <h3 className="text-lg font-semibold text-gray-200">
          Your Wallets ({wallets.length}/{MAX_WALLETS})
        </h3>
      </div>

      {wallets.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-slate-800/60 rounded-xl flex items-center justify-center mx-auto mb-4 border border-slate-600/40">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="text-slate-300 text-lg font-medium">No wallets connected</p>
          <p className="text-slate-500 text-sm mt-2">Add a wallet to start tracking your trading activity</p>
        </div>
      ) : (
        <div className="space-y-4">
          {wallets.map(wallet => (
            <div 
              key={wallet.id} 
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-emerald-600/10 opacity-0 group-hover:opacity-100 blur-sm transition-all duration-300 rounded-xl"></div>
              <div className="relative bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border border-blue-500/40 rounded-xl p-6 shadow-lg transition-all duration-300 hover:border-emerald-500/60">
                <div className="flex items-center justify-between">
                  <div className="flex-grow">
                    {editingWalletId === wallet.id ? (
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={newLabel}
                          onChange={(e) => setNewLabel(e.target.value)}
                          className="bg-slate-800/60 text-white px-4 py-2.5 rounded-lg border border-blue-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 w-full transition-all duration-200"
                          disabled={isUpdating}
                          placeholder="Enter wallet name"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateWallet(wallet.id)}
                            disabled={isUpdating}
                            className="p-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-lg hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 transition-all duration-200 shadow-sm"
                            aria-label="Save wallet name"
                          >
                            {isUpdating ? (
                              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                            ) : (
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={isUpdating}
                            className="p-2.5 bg-slate-700 text-gray-400 rounded-lg hover:bg-slate-600 hover:text-white disabled:opacity-50 transition-all duration-200"
                            aria-label="Cancel editing"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="font-semibold text-white flex items-center gap-3 mb-3">
                          <span className="text-lg">{wallet.label || 'My Wallet'}</span>
                          <button
                            onClick={() => handleEditWallet(wallet)}
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-700/50 rounded-lg transition-all duration-200"
                            aria-label="Edit wallet name"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        </div>
                        <div className="text-slate-300 text-sm font-mono bg-gradient-to-r from-blue-900/30 to-emerald-900/30 px-4 py-3 rounded-lg border border-blue-500/30">
                          <span className="block sm:hidden">
                            {/* Mobile: Show abbreviated version */}
                            {wallet.wallet_address.slice(0, 6)}...{wallet.wallet_address.slice(-6)}
                          </span>
                          <span className="hidden sm:block md:hidden">
                            {/* Tablet: Show slightly longer version */}
                            {wallet.wallet_address.slice(0, 8)}...{wallet.wallet_address.slice(-8)}
                          </span>
                          <span className="hidden md:block">
                            {/* Desktop: Show full address */}
                            {wallet.wallet_address}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteClick(wallet)}
                    disabled={isRemoving === wallet.id || editingWalletId === wallet.id}
                    className="ml-4 p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 rounded-lg transition-all duration-300"
                    aria-label="Remove wallet"
                  >
                    {isRemoving === wallet.id ? (
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Enhanced Delete confirmation modal */}
      {showDeleteConfirm && walletToDelete && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Full page overlay with blur */}
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={handleCancelDelete}
          />
          
          {/* Modal content */}
          <div className="relative bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-red-900/20 p-8 max-w-md w-full border border-red-500/30">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-red-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-900/15">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.1 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-red-400">Delete Wallet?</h3>
            </div>
            
            <p className="text-gray-300 mb-4">
              Are you sure you want to delete <span className="font-semibold text-white">"{walletToDelete.label || 'My Wallet'}"</span>?
            </p>
            
            <div className="bg-gradient-to-r from-red-900/30 to-red-800/30 border border-red-500/30 rounded-xl p-4 mb-6">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
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
                className="px-6 py-3 bg-[#252525]/80 text-gray-200 rounded-xl hover:bg-[#303030] transition-all duration-300 order-2 sm:order-1"
                onClick={handleCancelDelete}
              >
                Cancel
              </button>
              <button
                className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-xl hover:from-red-500 hover:to-red-400 transition-all duration-300 font-semibold transform hover:scale-105 shadow-lg shadow-red-900/15 order-1 sm:order-2"
                onClick={handleConfirmDelete}
              >
                Delete Wallet
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default WalletList; 
