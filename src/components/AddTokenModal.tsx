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
        className="absolute inset-0 bg-black bg-opacity-70 backdrop-blur-sm"
        onClick={showProgress ? undefined : onClose}
      />

      {/* Modal */}
      <div 
        ref={modalRef}
        className="relative bg-[#1a1a1a] border border-gray-700 rounded-xl shadow-2xl max-w-md w-full mx-4 transform transition-all duration-200 ease-out"
        style={{
          animation: 'slideDownFadeIn 0.2s ease-out forwards'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            {/* Icon with special styling to indicate it's a tool/action */}
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
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
            <h2 className="text-xl font-bold text-white">Add Token</h2>
          </div>

          <button
            onClick={onClose}
            disabled={showProgress}
            className={`p-2 rounded-lg text-gray-400 transition-colors ${
              showProgress 
                ? 'opacity-50 cursor-not-allowed' 
                : 'hover:bg-gray-800 hover:text-white'
            }`}
            aria-label="Close modal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
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

        {/* Content */}
        <div className="p-6">
          <div className="mb-6">
            <p className="text-gray-300 text-sm leading-relaxed">
              We will scan your wallet for trades associated with this token and they will be added to the Trade Log.
            </p>
          </div>

          {/* Selected Wallet Info */}
          <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Selected Wallet</h3>
            {selectedWalletId && wallets ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-medium">
                      {wallets.find(w => w.id === selectedWalletId)?.label || 
                       wallets.find(w => w.id === selectedWalletId)?.nickname || 
                       `${wallets.find(w => w.id === selectedWalletId)?.wallet_address.substring(0, 6)}...${wallets.find(w => w.id === selectedWalletId)?.wallet_address.slice(-4)}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {wallets.find(w => w.id === selectedWalletId)?.wallet_address.substring(0, 12)}...{wallets.find(w => w.id === selectedWalletId)?.wallet_address.slice(-8)}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-yellow-500 text-sm">Please select a wallet first</p>
            )}
          </div>

          {/* Token Address Form */}
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="tokenAddress" className="block text-sm font-medium text-gray-300 mb-2">
                  Token Contract Address
                </label>
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    id="tokenAddress"
                    value={contractAddress}
                    onChange={handleInputChange}
                    placeholder="Enter token contract address"
                    className={`w-full bg-gray-800/50 border rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
                      validationError 
                        ? 'border-red-500 focus:ring-red-500/50 focus:border-red-500/50' 
                        : 'border-gray-700 focus:ring-purple-500/50 focus:border-purple-500/50'
                    }`}
                    disabled={isLoading || !selectedWalletId}
                  />
                  {isLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <svg className="animate-spin h-5 w-5 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  )}
                </div>
                <div className="min-h-[20px]">
                  {validationError ? (
                    <p className="mt-2 text-xs text-red-400">
                      {validationError}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-gray-500">
                      Enter the contract address of the token you want to track
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !selectedWalletId || !contractAddress.trim() || !!validationError}
                  className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg shadow-lg hover:from-purple-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {isLoading ? 'Adding Token...' : 'Add Token'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Progress Modal */}
      {showProgress && (
        <div className="fixed inset-0 z-60 flex items-center justify-center">
          {/* Backdrop - No click to close during progress */}
          <div className="absolute inset-0 bg-black bg-opacity-80 backdrop-blur-sm" />
          
          {/* Progress Modal */}
          <div className="relative bg-[#1a1a1a] border border-gray-700 rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="animate-spin h-8 w-8 text-purple-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Adding Token</h3>
              <p className="text-gray-300 text-sm mb-4">{progressMessage}</p>
              <div className="flex items-center justify-center space-x-2 text-xs text-gray-400">
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
