import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { addNewTokenService, AddTokenResult } from '../services/addNewToken';
import { supabase } from '../utils/supabaseClient';
import { useWalletSelection } from '../contexts/WalletSelectionContext';
import { isValidSolanaAddress } from '../utils/userProfile';
import TokenAddResultModal from './TokenAddResultModal';

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
  // Add debug logging for props
  useEffect(() => {
    console.log('🔍 AddTokenModal props changed:', { isOpen, onClose: typeof onClose, onAddToken: typeof onAddToken });
  }, [isOpen, onClose, onAddToken]);

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

  // Bring back result modal states for transforming progress modal
  const [showResultModal, setShowResultModal] = useState(false);
  const [tokenResult, setTokenResult] = useState<AddTokenResult | null>(null);
  const [lastTokenSymbol, setLastTokenSymbol] = useState<string>('');
  const [resultTokenAddress, setResultTokenAddress] = useState<string>(''); // Store address for result modal

  // Get wallet data from context
  const { selectedWalletId, wallets } = useWalletSelection();

  // State for portal container
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  // Effect to create portal container
  useEffect(() => {
    // Create portal container if it doesn't exist
    let container = document.getElementById('modal-root');
    if (!container) {
      container = document.createElement('div');
      container.id = 'modal-root';
      document.body.appendChild(container);
    }
    setPortalContainer(container);

    // Cleanup function to remove container
    return () => {
      if (container && container.parentElement) {
        container.parentElement.removeChild(container);
      }
    };
  }, []);

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
    setProgressMessage('Initializing token analysis...');

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

      setProgressMessage('Analyzing token data...');

      // Use addNewTokenService instead of tokenAdditionService to ensure tokens are properly added to trading_history
      const result = await addNewTokenService.addNewToken(
        userId,
        walletAddress,
        contractAddress.trim()
      );

      setShowProgress(false);

      if (result.success) {
        console.log('✅ Token added successfully:', result.message);
        if (onAddToken) {
          onAddToken(contractAddress.trim());
        }

        // Transform progress modal into result modal
        console.log('Setting state for success case:', { result });

        // Use a single setState call to update all related states
        // This ensures that React doesn't batch them in an unexpected way
        setTokenResult(result);
        setLastTokenSymbol(result.tokenSymbol || '');
        setResultTokenAddress(contractAddress.trim());
        setContractAddress('');
        setIsLoading(false);

        // Important: Set showResultModal to true and then use a timeout to set showProgress to false
        // This ensures that the result modal is visible before the progress modal disappears
        console.log('About to set showResultModal to true');
        setShowResultModal(true);

        // Use a small timeout to ensure the result modal is rendered before hiding the progress modal
        setTimeout(() => {
          console.log('About to set showProgress to false (after timeout)');
          setShowProgress(false);
          console.log('State updates complete for success case');
        }, 50); // Small timeout to ensure state updates are processed
      } else {
        // Handle error message differently based on which service was used
        const errorMessage = 'error' in result ? result.error : `Failed to add token: ${result.message}`;
        console.error('❌ Failed to add token:', errorMessage);

        // Transform progress modal into result modal for error too
        console.log('Setting state for error case:', { result });

        // Use a single setState call to update all related states
        // This ensures that React doesn't batch them in an unexpected way
        setTokenResult(result);
        setLastTokenSymbol(result.tokenSymbol || '');
        setResultTokenAddress(contractAddress.trim());
        setContractAddress('');
        setIsLoading(false);

        // Important: Set showResultModal to true and then use a timeout to set showProgress to false
        // This ensures that the result modal is visible before the progress modal disappears
        console.log('About to set showResultModal to true (error case)');
        setShowResultModal(true);

        // Use a small timeout to ensure the result modal is rendered before hiding the progress modal
        setTimeout(() => {
          console.log('About to set showProgress to false (error case, after timeout)');
          setShowProgress(false);
          console.log('State updates complete for error case');
        }, 50); // Small timeout to ensure state updates are processed
      }
    } catch (error) {
      console.error('💥 Error adding token:', error);

      // Handle specific error types with user-friendly messages
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

      // Transform progress modal into result modal for catch errors too
      const errorResult: AddTokenResult = {
        success: false,
        message: errorMessage.includes('408') || errorMessage.includes('timeout') || errorMessage.includes('free tier') 
          ? 'Request timed out due to RPC limits. Please try again later or consider upgrading your RPC plan.'
          : errorMessage,
        tradesFound: 0,
        tokenSymbol: undefined,
        error: errorMessage.includes('408') || errorMessage.includes('timeout') ? 'RPC_TIMEOUT' : undefined
      };

      console.log('Setting state for catch block:', { errorResult });

      // Use a single setState call to update all related states
      // This ensures that React doesn't batch them in an unexpected way
      setTokenResult(errorResult);
      setLastTokenSymbol('');
      setResultTokenAddress(contractAddress.trim());
      setContractAddress('');
      setIsLoading(false);

      // Important: Set showResultModal to true and then use a timeout to set showProgress to false
      // This ensures that the result modal is visible before the progress modal disappears
      console.log('About to set showResultModal to true (catch block)');
      setShowResultModal(true);

      // Use a small timeout to ensure the result modal is rendered before hiding the progress modal
      setTimeout(() => {
        console.log('About to set showProgress to false (catch block, after timeout)');
        setShowProgress(false);
        console.log('State updates complete for catch block');
      }, 50); // Small timeout to ensure state updates are processed
    }
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

  if (!isOpen || !portalContainer) return null;

  console.log('Rendering AddTokenModal with state:', { 
    showProgress, 
    showResultModal, 
    tokenResult, 
    lastTokenSymbol, 
    resultTokenAddress 
  });

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      {/* Modal Content */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[10000] w-full max-w-md">
        {/* Main Modal */}
        {!showProgress && (
          <div 
            ref={modalRef}
            className="relative bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-950 border border-emerald-400/40 rounded-3xl shadow-2xl shadow-emerald-900/30 w-full"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-emerald-400/20">
              <div className="flex items-center gap-4">
                {/* Icon with TradeStats styling */}
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 via-teal-600 to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/40 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-teal-400/20 to-amber-400/20 animate-pulse"></div>
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-6 w-6 text-white relative z-10" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2.5} 
                      d="M12 4v16m8-8H4" 
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-300 via-teal-300 to-amber-300 bg-clip-text text-transparent">
                  Add Token to TradeStats
                </h2>
              </div>

              <button
                onClick={showProgress ? undefined : onClose}
                disabled={showProgress}
                className="p-3 rounded-xl bg-slate-800/50 border border-emerald-400/30 hover:bg-slate-700/50 hover:border-emerald-400/50 text-gray-400 hover:text-emerald-200 transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="block text-sm font-semibold text-emerald-300 mb-3"
                  >
                    Solana Token Contract Address
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
                      className="w-full px-4 py-3 bg-gradient-to-br from-slate-800/80 via-emerald-950/80 to-teal-950/80 backdrop-blur-sm border border-emerald-400/30 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-400/5 to-teal-400/5 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
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
                      <p className="mt-2 text-xs text-emerald-400/80 flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Enter the contract address of the token you want to track in TradeStats
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
                    className="group relative overflow-hidden px-6 py-3 text-sm font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-amber-600 text-white rounded-xl shadow-lg shadow-emerald-500/30 hover:from-emerald-500 hover:via-teal-500 hover:to-amber-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100"
                  >
                    {/* Animated background */}
                    <div className="absolute inset-0 bg-gradient-to-r from-teal-400/20 to-amber-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    
                    <span className="relative">
                      {isLoading ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
        )}

        {/* Progress Modal */}
        {showProgress && (
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[10000] w-full max-w-md">
            <div className="relative bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-950 border border-emerald-400/40 rounded-3xl shadow-2xl shadow-emerald-900/30 w-full p-8">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-500/20 via-teal-500/20 to-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6 relative overflow-hidden">
                  <svg className="animate-spin h-10 w-10 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400/10 via-teal-400/10 to-amber-400/10 animate-pulse"></div>
                </div>
                <h3 className="text-xl font-bold bg-gradient-to-r from-emerald-300 via-teal-300 to-amber-300 bg-clip-text text-transparent mb-3">
                  TradeStats Analysis In Progress
                </h3>
                <p className="text-emerald-200 text-sm mb-6">{progressMessage}</p>
                <div className="flex items-center justify-center space-x-2 text-xs text-emerald-300/80 bg-gradient-to-r from-emerald-900/20 via-teal-900/20 to-amber-900/20 rounded-xl p-3 border border-emerald-400/20">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>TradeStats is analyzing your token data - please wait</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Result Modal - Transform from progress modal */}
        <TokenAddResultModal
          isOpen={showResultModal}
          onClose={() => {
            console.log('TokenAddResultModal onClose called');
            setShowResultModal(false);
            setTokenResult(null);
            setLastTokenSymbol('');
            // Don't automatically close the main modal
            // This allows the user to see the result and then decide what to do next
          }}
          result={tokenResult || { success: false, message: '', tradesFound: 0 }} // Provide a default result if null
          tokenAddress={resultTokenAddress}
          tokenSymbol={lastTokenSymbol}
        />
      </div>
    </div>,
    portalContainer
  );
};

export default AddTokenModal; 
