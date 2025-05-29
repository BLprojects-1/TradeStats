import React, { useState, useEffect, useRef } from 'react';
import { addNewTokenService } from '../services/addNewToken';
import { supabase } from '../utils/supabaseClient';
import { useWalletSelection } from '../contexts/WalletSelectionContext';
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
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Handle escape key to close
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!contractAddress.trim()) return;
    
    setIsLoading(true);
    
    try {
      // Get wallet address from context
      const walletAddress = getActiveWalletAddress();
      
      if (!walletAddress) {
        console.error('❌ No active wallet selected. Please select a wallet first.');
        // You can show an error toast/notification here: "Please select a wallet first"
        setIsLoading(false);
        return;
      }

      // Get user ID from authenticated session
      const userId = await getAuthenticatedUserId();
      
      if (!userId) {
        console.error('❌ Could not get user ID from session. Please sign in again.');
        // You can show an error toast/notification here: "Please sign in again"
        setIsLoading(false);
        return;
      }

      console.log('🚀 Starting token addition with:', { userId, walletAddress, tokenAddress: contractAddress.trim() });

      const result = await addNewTokenService.addNewToken(
        userId,
        walletAddress,
        contractAddress.trim()
      );
      
      if (result.success) {
        console.log('✅ Token added successfully:', result.message);
        // You can show a success toast/notification here
        if (onAddToken) {
          onAddToken(contractAddress.trim());
        }
      } else {
        console.error('❌ Failed to add token:', result.error);
        // You can show an error toast/notification here
      }
    } catch (error) {
      console.error('💥 Error adding token:', error);
      // Handle error - show error toast/notification
    }
    
    // Reset form and close modal
    setContractAddress('');
    setIsLoading(false);
    onClose();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContractAddress(e.target.value);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-70 backdrop-blur-sm"
        onClick={onClose}
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
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
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

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="contract-address" className="block text-sm font-medium text-gray-200 mb-2">
                Token Contract Address (CA)
              </label>
              <input
                ref={inputRef}
                id="contract-address"
                type="text"
                value={contractAddress}
                onChange={handleInputChange}
                placeholder="Enter token contract address..."
                className="w-full px-4 py-3 bg-[#1d1d23] border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-white placeholder-gray-400 transition-all duration-200"
                disabled={isLoading}
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors duration-200 font-medium"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!contractAddress.trim() || isLoading}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 font-medium flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading transactions...
                  </>
                ) : (
                  'Add Token'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddTokenModal; 