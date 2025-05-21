import { useState } from 'react';
import { addTrackedWallet, TrackedWallet } from '../utils/userProfile';

interface AddWalletModalProps {
  userId: string;
  onClose: () => void;
  onSuccess: (wallet: TrackedWallet) => void;
}

const AddWalletModal = ({ userId, onClose, onSuccess }: AddWalletModalProps) => {
  const [walletAddress, setWalletAddress] = useState('');
  const [walletLabel, setWalletLabel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateWalletAddress = (address: string): boolean => {
    // Basic Solana wallet address validation (44 characters starting with a base58 character)
    const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;
    return solanaAddressRegex.test(address);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validate input
    if (!walletAddress.trim()) {
      setError('Please enter a wallet address');
      return;
    }

    if (!validateWalletAddress(walletAddress)) {
      setError('Please enter a valid Solana wallet address');
      return;
    }

    // Ensure we have a valid user ID
    if (!userId) {
      setError('User ID is missing. Please try logging out and back in.');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await addTrackedWallet(userId, walletAddress, walletLabel || 'My Wallet');
      
      if (!result) {
        throw new Error('Failed to add wallet address');
      }
      
      // Pass the newly added wallet to the success callback
      onSuccess(result);
      onClose();
    } catch (err) {
      console.error('Failed to add wallet:', err);
      
      // Handle specific error messages
      if (err instanceof Error) {
        if (err.message.includes('already exists')) {
          setError('This wallet address is already added to your account');
        } else if (err.message.includes('foreign key') || err.message.includes('User ID')) {
          setError('Authentication error: Please log out and log back in.');
        } else if (err.message.includes('401') || err.message.includes('Invalid API key')) {
          setError(
            'Authorization error: Your Supabase RLS policies need to be updated. ' +
            'Please follow the instructions in supabase/README.md or run the fix-permissions.sh script.'
          );
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to add wallet. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4">
      <div className="bg-[#1a1a1a] rounded-xl shadow-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-indigo-200">Add Wallet Address</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
        
        {error && (
          <div className="bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="walletLabel" className="block text-sm font-medium text-gray-300 mb-1">
              Wallet Label (optional)
            </label>
            <input
              type="text"
              id="walletLabel"
              value={walletLabel}
              onChange={(e) => setWalletLabel(e.target.value)}
              placeholder="My Trading Wallet"
              className="w-full px-4 py-2 bg-[#212121] text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          <div className="mb-6">
            <label htmlFor="walletAddress" className="block text-sm font-medium text-gray-300 mb-1">
              Solana Wallet Address
            </label>
            <input
              type="text"
              id="walletAddress"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="Enter Solana wallet address"
              className="w-full px-4 py-2 bg-[#212121] text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>
          
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition disabled:opacity-70"
            >
              {isSubmitting ? 'Adding...' : 'Add Wallet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddWalletModal; 