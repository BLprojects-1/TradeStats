import React from 'react';
import { refreshWalletService } from '../services/refreshWallet';

interface WalletScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: { newTradesCount: number, message: string }) => void;
  walletAddress: string;
  userId: string;
}

const WalletScanModal: React.FC<WalletScanModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  walletAddress,
  userId
}) => {
  const [isScanning, setIsScanning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartScan = async () => {
    try {
      setIsScanning(true);
      setError(null);
      
      // Call the refreshWalletService to scan the wallet
      const result = await refreshWalletService.refreshWalletTrades(walletAddress, userId);
      
      // Calculate the number of new trades found
      const newTradesCount = result.recentTrades.length;
      
      // Call onSuccess with the result
      onSuccess({
        newTradesCount,
        message: newTradesCount > 0 
          ? `Found ${newTradesCount} new trades!` 
          : "You're up to date!"
      });
      
      // Close the modal
      onClose();
    } catch (err) {
      console.error('Error scanning wallet:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-700">
        <h2 className="text-xl font-semibold text-white mb-4">Wallet Scan Required</h2>
        
        <p className="text-gray-300 mb-4">
          To provide you with accurate trading history and portfolio performance, we need to scan your wallet address:
        </p>
        
        <div className="bg-gray-800 p-2 rounded mb-4 font-mono text-sm text-yellow-400 break-all">
          {walletAddress}
        </div>
        
        <p className="text-gray-300 mb-2">This scan will:</p>
        
        <ul className="list-disc pl-5 mb-4 text-gray-300 space-y-1">
          <li>Find all trades for tokens you've interacted with since your last scan</li>
          <li>Calculate your portfolio performance</li>
          <li>Enable automatic trade tracking</li>
        </ul>
        
        <p className="text-gray-400 text-sm mb-6">
          The scan may take up to 2 minutes. Without this scan, we won't be able to automatically track your trading history.
        </p>
        
        {error && (
          <div className="bg-red-900 bg-opacity-30 border border-red-700 text-red-300 p-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
            disabled={isScanning}
          >
            Cancel
          </button>
          
          <button
            onClick={handleStartScan}
            disabled={isScanning}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded flex items-center"
          >
            {isScanning ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Scanning...
              </>
            ) : (
              'Start Scan'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WalletScanModal;