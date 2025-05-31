import React, { useState, useEffect, useRef } from 'react';
import { addNewTokenService } from '../services/addNewToken';
import { supabase } from '../utils/supabaseClient';
import { useWalletSelection } from '../contexts/WalletSelectionContext';
import { isValidSolanaAddress } from '../utils/userProfile';
// import { useAuth } from '../context/AuthContext'; // Uncomment if using context approach
// import { useWallet } from '../context/WalletContext'; // Uncomment if using context approach

interface AddTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToken?: (contractAddress: string) => void;
}

// Alternative: Context-based approach (uncomment if preferred)
// interface AddTokenModalProps {
//   isOpen: boolean;
//   onClose: () => void;
//   onAddToken?: (contractAddress: string) => void;
// }

const AddTokenModal = ({ isOpen, onClose, onAddToken }: AddTokenModalProps) => {
  // Alternative: Get from context instead of props (uncomment if preferred)
  // const { user } = useAuth();
  // const { selectedWallet } = useWallet();
  // const userId = user?.id;
  // const walletAddress = selectedWallet?.address;

  const [contractAddress, setContractAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [validationError, setValidationError] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get wallet data from context
  const { selectedWalletId, wallets } = useWalletSelection();

  // Function to get active wallet address from context
  const getActiveWalletAddress = (): string | null => {
    try {
      if (!selectedWalletId || !wallets || wallets.length === 0) {
        console.log('❌ No selected wallet ID or no wallets available');
        return null;
      }

      // Find the selected wallet in the wallets array
      const selectedWallet = wallets.find(wallet => wallet.id === selectedWalletId);

      if (!selectedWallet) {
        console.log('❌ Selected wallet not found in wallets array');
        return null;
      }

      console.log('✅ Found active wallet address:', selectedWallet.wallet_address);
      return selectedWallet.wallet_address;
    } catch (error) {
      console.error('Error getting active wallet address:', error);
      return null;
    }
  };

  // Function to get authenticated user ID from session
  const getAuthenticatedUserId = async (): Promise<string | null> => {
    try {
      console.log('🔍 Getting user ID from authenticated session...');

      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Error getting session:', error);
        return null;
      }

      if (!session || !session.user) {
        console.error('No authenticated session found');
        return null;
      }

      console.log('✅ Found authenticated user ID:', session.user.id);
      return session.user.id;
    } catch (error) {
      console.error('Error in getAuthenticatedUserId:', error);
      return null;
    }
  };

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      // Don't allow closing if progress modal is showing
      if (showProgress) return;
      
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, showProgress]);

  // Handle escape key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleEscapeKey = (e: KeyboardEvent) => {
      // Don't allow closing if progress modal is showing
      if (showProgress) return;
      
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [isOpen, onClose, showProgress]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!contractAddress.trim()) return;

    // Validate token address format
    if (!isValidSolanaAddress(contractAddress.trim())) {
      setValidationError('Please enter a valid Solana token address');
      return;
    }

    setIsLoading(true);
    setShowProgress(true);
    setProgressMessage('Initializing token scan...');

    try {
      // Get wallet address from context
      const walletAddress = getActiveWalletAddress();

      if (!walletAddress) {
        console.error('❌ No active wallet selected. Please select a wallet first.');
        setValidationError('Please select a wallet first');
        setIsLoading(false);
        setShowProgress(false);
        return;
      }

      // Get user ID from authenticated session
      const userId = await getAuthenticatedUserId();

      if (!userId) {
        console.error('❌ Could not get user ID from session. Please sign in again.');
        setValidationError('Please sign in again');
        setIsLoading(false);
        setShowProgress(false);
        return;
      }

      console.log('🚀 Starting token addition with:', { userId, walletAddress, tokenAddress: contractAddress.trim() });

      setProgressMessage('Fetching token information...');

      // Use addNewTokenService instead of tokenAdditionService to ensure tokens are properly added to trading_history
      const result = await addNewTokenService.addNewToken(
        userId,
        walletAddress,
        contractAddress.trim()
      );

      setShowProgress(false);

      if (result.success) {
        console.log('✅ Token added successfully:', result.message);
        // You can show a success toast/notification here
        if (onAddToken) {
          onAddToken(contractAddress.trim());
        }
      } else {
        // Handle error message differently based on which service was used
        const errorMessage = 'error' in result ? result.error : `Failed to add token: ${result.message}`;
        console.error('❌ Failed to add token:', errorMessage);
        setValidationError(errorMessage || 'Failed to add token');
      }
    } catch (error) {
      console.error('💥 Error adding token:', error);
      setShowProgress(false);
      setValidationError(error instanceof Error ? error.message : 'An unexpected error occurred');
    }

    // Reset form and close modal
    setContractAddress('');
    setIsLoading(false);
    onClose();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setContractAddress(value);
    
    // Clear validation error when user starts typing
    if (validationError) {
      setValidationError('');
    }
    
    // Validate address format if not empty
    if (value.trim() && !isValidSolanaAddress(value.trim())) {
      setValidationError('Invalid Solana token address format');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={showProgress ? undefined : onClose}
      />

      {/* Modal */}
      <div 
        ref={modalRef}
        className="relative bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl border border-indigo-500/40 rounded-3xl shadow-2xl shadow-indigo-900/20 max-w-md w-full mx-4 transform transition-all duration-200 ease-out"
        style={{
          animation: 'slideDownFadeIn 0.2s ease-out forwards'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-indigo-500/20">
          <div className="flex items-center gap-4">
            {/* Icon with special styling to indicate it's a tool/action */}
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/30">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-6 w-6 text-white" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 4v16m8-8H4" 
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Add Token</h2>
          </div>

          <button
            onClick={showProgress ? undefined : onClose}
            disabled={showProgress}
            className="p-3 rounded-xl bg-slate-800/50 border border-indigo-500/30 hover:bg-slate-700/50 hover:border-indigo-500/50 text-gray-400 hover:text-gray-200 transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close modal"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M6 18L18 6M6 6l12 12" 
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label 
                htmlFor="contractAddress" 
                className="block text-sm font-medium text-indigo-300 mb-2"
              >
                Token Contract Address
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  id="contractAddress"
                  value={contractAddress}
                  onChange={handleInputChange}
                  placeholder="Enter contract address (e.g., So11111111111111111111112)"
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-gradient-to-br from-[#1a1a2e]/80 to-[#1a1a28]/80 backdrop-blur-sm border border-indigo-500/30 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-500/5 to-purple-500/5 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              </div>

              <div className="min-h-[20px]">
                {validationError ? (
                  <p className="mt-2 text-xs text-red-400 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {validationError}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-gray-500 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Enter the contract address of the token you want to track
                  </p>
                )}
              </div>
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
                disabled={isLoading || !selectedWalletId || !contractAddress.trim() || !!validationError}
                className="px-6 py-3 text-sm font-medium bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl shadow-lg shadow-indigo-900/30 hover:from-indigo-500 hover:to-purple-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100"
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Adding Token...
                  </span>
                ) : 'Add Token'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Progress Modal */}
      {showProgress && (
        <div className="fixed inset-0 z-60 flex items-center justify-center">
          {/* Backdrop - No click to close during progress */}
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />
          
          {/* Progress Modal */}
          <div className="relative bg-gradient-to-br from-[#1a1a2e]/95 to-[#1a1a28]/95 backdrop-blur-xl border border-indigo-500/40 rounded-3xl shadow-2xl shadow-indigo-900/20 max-w-md w-full mx-4 p-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                <svg className="animate-spin h-10 w-10 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 animate-pulse"></div>
              </div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-3">Adding Token</h3>
              <p className="text-gray-300 text-sm mb-6">{progressMessage}</p>
              <div className="flex items-center justify-center space-x-2 text-xs text-gray-400 bg-gradient-to-r from-indigo-900/20 to-purple-900/20 rounded-xl p-3 border border-indigo-500/20">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Please wait, this process cannot be interrupted</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddTokenModal; 
